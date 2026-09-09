import { NextResponse } from "next/server";
import {
  InternalError,
  PlanLimitError,
  RateLimitError,
  UnauthorizedError,
  UpstreamProviderError,
  toErrorResponse,
} from "@/lib/server/errors";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan, getMonthlyRewriteCount } from "@/lib/server/plan-usage";
import { PLAN_CONFIG } from "@/lib/server/plans";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limiter";
import { recordUsage } from "@/lib/server/usage-tracker";
import { loadCustomVoiceRecord } from "@/lib/server/custom-voice";
import { loadOwnedDocument, type DocumentChunkRow } from "@/lib/server/documents/access";
import { processChunkText } from "@/lib/server/documents/process-chunk";
import { joinChunkResults } from "@/lib/server/documents/chunk";
import { MAX_CHUNK_ATTEMPTS } from "@/lib/server/documents/limits";
import type { AiModelId, LanguageId, ModeId } from "@/lib/modes";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function statusResponse(params: {
  status: "processing" | "ready" | "failed";
  chunkCount: number;
  chunksCompleted: number;
  currentChunkIndex: number | null;
  resultText?: string | null;
  errorMessage?: string | null;
}) {
  return NextResponse.json({
    status: params.status,
    chunkCount: params.chunkCount,
    chunksCompleted: params.chunksCompleted,
    currentChunkIndex: params.currentChunkIndex,
    resultText: params.resultText ?? null,
    errorMessage: params.errorMessage ?? null,
  });
}

/**
 * Advances a document's processing by exactly one chunk per call. The
 * client drives this in a loop (see components/DocumentUpload -- calls
 * this repeatedly while status === "processing"), which is what produces
 * the required "Processing section X of N..." progress UI and keeps each
 * HTTP request short (one AI call, bounded by the provider's own
 * REQUEST_TIMEOUT_MS) instead of one long-running request for the whole
 * document.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const identifier = getClientIdentifier(request);

  try {
    const rate = checkRateLimit(identifier);
    if (!rate.allowed) {
      throw new RateLimitError(rate.retryAfterMs);
    }

    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const document = await loadOwnedDocument(supabase, user.id, id);

    if (document.status === "ready") {
      return statusResponse({
        status: "ready",
        chunkCount: document.chunk_count,
        chunksCompleted: document.chunks_completed,
        currentChunkIndex: null,
        resultText: document.result_text,
      });
    }

    // Calling /process on a failed document is the Retry action: reset
    // the chunk that exhausted its attempts and pick up where it left
    // off, rather than restarting the whole document or requiring a
    // separate retry endpoint.
    if (document.status === "failed") {
      await supabase
        .from("document_chunks")
        .update({ status: "pending", attempts: 0 })
        .eq("document_id", document.id)
        .eq("status", "failed");
      await supabase
        .from("documents")
        .update({ status: "processing", error_message: null })
        .eq("id", document.id);
    } else if (document.status === "pending") {
      await supabase.from("documents").update({ status: "processing" }).eq("id", document.id);
    }

    const { data: nextChunk, error: nextChunkError } = await supabase
      .from("document_chunks")
      .select("*")
      .eq("document_id", document.id)
      .eq("status", "pending")
      .order("chunk_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextChunkError) {
      console.error("Failed to load next document chunk:", nextChunkError);
      throw new InternalError();
    }

    // No pending chunk left -- every chunk has reached "done" (a chunk
    // that failed permanently would have put the document in "failed"
    // and returned above, so reaching here with no pending chunk means
    // completion). Assemble the final result in original chunk order.
    if (!nextChunk) {
      const { data: allChunks, error: allChunksError } = await supabase
        .from("document_chunks")
        .select("chunk_index, output_text, status")
        .eq("document_id", document.id)
        .order("chunk_index", { ascending: true });

      if (allChunksError || !allChunks || allChunks.some((c) => c.status !== "done")) {
        console.error("Document has no pending chunk but isn't fully done:", allChunksError, allChunks);
        throw new InternalError("Something went wrong finishing this document. Please try again.");
      }

      const resultText = joinChunkResults(allChunks.map((c) => c.output_text ?? ""));

      await supabase
        .from("documents")
        .update({ status: "ready", result_text: resultText })
        .eq("id", document.id);

      return statusResponse({
        status: "ready",
        chunkCount: document.chunk_count,
        chunksCompleted: document.chunk_count,
        currentChunkIndex: null,
        resultText,
      });
    }

    const chunk = nextChunk as DocumentChunkRow;

    // Re-checked here, not just at upload: a concurrent tab/request could
    // have consumed quota in between. Failing mid-document is honest --
    // chunks_completed on the document row shows exactly how far it got --
    // rather than silently finishing on a partial result.
    const plan = await getUserPlan(supabase, user.id);
    const planLimits = PLAN_CONFIG[plan].limits;
    if (planLimits.monthlyRewriteQuota !== null) {
      const usedThisMonth = await getMonthlyRewriteCount(supabase, user.id);
      if (usedThisMonth >= planLimits.monthlyRewriteQuota) {
        const message = `You've used all ${planLimits.monthlyRewriteQuota} rewrites included in your ${PLAN_CONFIG[plan].name} plan this month. Upgrade for a higher monthly limit.`;
        await supabase.from("documents").update({ status: "failed", error_message: message }).eq("id", document.id);
        throw new PlanLimitError(message);
      }
    }

    const voiceRecord = await loadCustomVoiceRecord(supabase, user.id, document.voice);
    const startedAt = Date.now();

    try {
      const outputText = await processChunkText({
        text: chunk.input_text,
        mode: document.mode as ModeId,
        voice: document.voice,
        voiceRecord,
        aiModel: document.ai_model as AiModelId,
        language: document.language as LanguageId,
      });

      await supabase
        .from("document_chunks")
        .update({ status: "done", output_text: outputText })
        .eq("id", chunk.id);

      const chunksCompleted = document.chunks_completed + 1;
      await supabase.from("documents").update({ chunks_completed: chunksCompleted }).eq("id", document.id);

      // Every processed chunk is, mechanically, one rewrite -- recorded
      // into rewrites_history exactly like /api/rewrite does, so it
      // counts toward the same monthly quota via getMonthlyRewriteCount
      // with no separate tracking mechanism to keep in sync.
      await supabase.from("rewrites_history").insert({
        user_id: user.id,
        input_text: chunk.input_text,
        output_text: outputText,
        mode: document.mode,
        voice: document.voice,
        ai_model: document.ai_model,
        language: document.language,
        latency_ms: Date.now() - startedAt,
      });

      recordUsage({
        mode: document.mode as ModeId,
        voice: document.voice,
        aiModel: document.ai_model as AiModelId,
        language: document.language as LanguageId,
        inputLength: chunk.input_text.length,
        outputLength: outputText.length,
        latencyMs: Date.now() - startedAt,
        success: true,
      });

      const isLastChunk = chunksCompleted >= document.chunk_count;
      if (!isLastChunk) {
        return statusResponse({
          status: "processing",
          chunkCount: document.chunk_count,
          chunksCompleted,
          currentChunkIndex: chunk.chunk_index + 1,
        });
      }

      // This was the last chunk -- assemble immediately rather than
      // waiting for one more client round-trip.
      const { data: allChunks } = await supabase
        .from("document_chunks")
        .select("chunk_index, output_text")
        .eq("document_id", document.id)
        .order("chunk_index", { ascending: true });

      const resultText = joinChunkResults((allChunks ?? []).map((c) => c.output_text ?? ""));
      await supabase.from("documents").update({ status: "ready", result_text: resultText }).eq("id", document.id);

      return statusResponse({
        status: "ready",
        chunkCount: document.chunk_count,
        chunksCompleted,
        currentChunkIndex: null,
        resultText,
      });
    } catch (chunkError) {
      const attempts = chunk.attempts + 1;
      recordUsage({
        mode: document.mode as ModeId,
        voice: document.voice,
        aiModel: document.ai_model as AiModelId,
        language: document.language as LanguageId,
        inputLength: chunk.input_text.length,
        outputLength: 0,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorCode: chunkError instanceof UpstreamProviderError ? chunkError.code : "CHUNK_FAILED",
      });

      if (attempts >= MAX_CHUNK_ATTEMPTS) {
        const message =
          "NXTIAI couldn't finish processing this document after several attempts. You can retry, or try again with a shorter document.";
        await supabase.from("document_chunks").update({ status: "failed", attempts }).eq("id", chunk.id);
        await supabase.from("documents").update({ status: "failed", error_message: message }).eq("id", document.id);
        return statusResponse({
          status: "failed",
          chunkCount: document.chunk_count,
          chunksCompleted: document.chunks_completed,
          currentChunkIndex: chunk.chunk_index + 1,
          errorMessage: message,
        });
      }

      // Bounded, automatic retry: leave the chunk "pending" so the
      // client's own processing loop naturally retries it on its next
      // call -- never retried indefinitely (capped at MAX_CHUNK_ATTEMPTS),
      // and never silently dropped.
      await supabase.from("document_chunks").update({ attempts }).eq("id", chunk.id);
      return statusResponse({
        status: "processing",
        chunkCount: document.chunk_count,
        chunksCompleted: document.chunks_completed,
        currentChunkIndex: chunk.chunk_index + 1,
      });
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
