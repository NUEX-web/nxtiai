import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limiter";
import { recordUsage } from "@/lib/server/usage-tracker";
import {
  InternalError,
  PlanLimitError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  toErrorResponse,
} from "@/lib/server/errors";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan, getMonthlyRewriteCount } from "@/lib/server/plan-usage";
import { PLAN_CONFIG } from "@/lib/server/plans";
import { extractText } from "@/lib/server/documents/extract";
import { chunkDocument } from "@/lib/server/documents/chunk";
import { parseDocumentRewriteSettings } from "@/lib/server/documents/validation";
import {
  ACCEPTED_MIME_TYPES,
  DOCUMENT_CHUNK_CHARS,
  MAX_DOCUMENT_CHARS,
  MAX_UPLOAD_BYTES,
  MIN_DOCUMENT_CHARS,
  extensionFromFilename,
  isAcceptedExtension,
} from "@/lib/server/documents/limits";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export async function POST(request: Request): Promise<Response> {
  const identifier = getClientIdentifier(request);

  try {
    const rate = checkRateLimit(identifier);
    if (!rate.allowed) {
      throw new RateLimitError(rate.retryAfterMs);
    }

    // Document upload/processing is a signed-in-only feature: results are
    // persisted per-user (documents table) and metered against the same
    // monthly rewrite quota as /api/rewrite, neither of which is
    // meaningful for an anonymous caller.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new UnauthorizedError("Sign in to upload a document.");
    }

    const formData = await request.formData().catch(() => {
      throw new ValidationError("Request must be multipart/form-data with a file field.");
    });

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("No file was uploaded.");
    }

    const settings = parseDocumentRewriteSettings({
      mode: formData.get("mode"),
      voice: formData.get("voice"),
      aiModel: formData.get("aiModel"),
      language: formData.get("language"),
    });

    if (file.size === 0) {
      throw new ValidationError("This file is empty.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ValidationError(
        `This file is too large -- the limit is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`
      );
    }

    const extension = extensionFromFilename(file.name);
    if (!isAcceptedExtension(extension)) {
      throw new ValidationError("Unsupported file type. Upload a PDF, DOC, DOCX, or TXT file.");
    }

    // Server-side MIME check alongside the extension -- never MIME alone
    // (trivially spoofable) and never extension alone (a mismatched MIME
    // type is still a useful signal). An empty/absent MIME type is
    // tolerated since browsers and OSes are inconsistent about setting it
    // for these formats; an actively wrong one is rejected.
    const allowedMimeTypes = ACCEPTED_MIME_TYPES[extension];
    if (file.type && !allowedMimeTypes.includes(file.type)) {
      throw new ValidationError("This file's contents don't match its extension.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractText(buffer, extension);

    if (extraction.text.length < MIN_DOCUMENT_CHARS) {
      throw new ValidationError("This document doesn't contain enough text to process.");
    }
    if (extraction.text.length > MAX_DOCUMENT_CHARS) {
      throw new ValidationError(
        `This document is too long to process (${extraction.text.length.toLocaleString()} characters -- the limit is ${MAX_DOCUMENT_CHARS.toLocaleString()}, about ${Math.floor(MAX_DOCUMENT_CHARS / 6.5).toLocaleString()} words). Try splitting it into smaller documents.`
      );
    }

    const wordCount = countWords(extraction.text);
    const charCount = extraction.text.length;

    const plan = await getUserPlan(supabase, user.id);
    const planLimits = PLAN_CONFIG[plan].limits;

    // Document chunk size is fixed (DOCUMENT_CHUNK_CHARS), independent of
    // the plan's own maxCharsPerRequest -- see the constant's comment in
    // lib/server/documents/limits.ts for why reusing that cap here (the
    // original behavior) made document processing needlessly slow,
    // especially on the Free plan.
    const chunks = chunkDocument(extraction.text, DOCUMENT_CHUNK_CHARS);

    // Every processed chunk consumes one unit of the same monthly rewrite
    // quota /api/rewrite enforces (each chunk is, mechanically, one
    // rewrite -- see app/api/documents/[id]/process/route.ts, which also
    // inserts into rewrites_history). Refusing upfront when the document
    // can't possibly finish is what makes "never claim a document was
    // fully processed when it wasn't" actually true -- partial processing
    // is never started in the first place.
    if (planLimits.monthlyRewriteQuota !== null) {
      const usedThisMonth = await getMonthlyRewriteCount(supabase, user.id);
      const remaining = planLimits.monthlyRewriteQuota - usedThisMonth;
      if (chunks.length > remaining) {
        throw new PlanLimitError(
          remaining > 0
            ? `This document needs ${chunks.length} rewrites to process, but your ${PLAN_CONFIG[plan].name} plan only has ${remaining} left this month. Upgrade for a higher limit, or try a shorter document.`
            : `You've used all ${planLimits.monthlyRewriteQuota} rewrites included in your ${PLAN_CONFIG[plan].name} plan this month. Upgrade for a higher monthly limit.`
        );
      }
    }

    const { data: document, error: insertError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        filename: file.name,
        file_extension: extension,
        original_text: extraction.text,
        word_count: wordCount,
        char_count: charCount,
        page_count: extraction.pageCount,
        page_count_is_estimate: extraction.pageCountIsEstimate,
        chunk_count: chunks.length,
        chunks_completed: 0,
        mode: settings.mode,
        voice: settings.voice,
        ai_model: settings.aiModel,
        language: settings.language,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !document) {
      console.error("Failed to insert document row:", insertError);
      throw new InternalError("Couldn't save the uploaded document. Please try again.");
    }

    const { error: chunksError } = await supabase.from("document_chunks").insert(
      chunks.map((chunk) => ({
        document_id: document.id,
        user_id: user.id,
        chunk_index: chunk.index,
        input_text: chunk.text,
      }))
    );

    if (chunksError) {
      console.error("Failed to insert document chunk rows:", chunksError);
      // Best-effort cleanup so a failed upload doesn't leave an orphaned,
      // permanently-stuck-at-0-chunks document behind.
      await supabase.from("documents").delete().eq("id", document.id);
      throw new InternalError("Couldn't save the uploaded document. Please try again.");
    }

    recordUsage({
      mode: settings.mode,
      voice: settings.voice,
      aiModel: settings.aiModel,
      language: settings.language,
      inputLength: charCount,
      outputLength: 0,
      latencyMs: 0,
      success: true,
    });

    return NextResponse.json({
      id: document.id,
      filename: file.name,
      originalText: extraction.text,
      wordCount,
      charCount,
      pageCount: extraction.pageCount,
      pageCountIsEstimate: extraction.pageCountIsEstimate,
      chunkCount: chunks.length,
      status: "pending",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
