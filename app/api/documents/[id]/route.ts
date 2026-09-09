import { NextResponse } from "next/server";
import { UnauthorizedError, toErrorResponse } from "@/lib/server/errors";
import { createClient } from "@/lib/supabase/server";
import { loadOwnedDocument } from "@/lib/server/documents/access";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Status/result summary for a document -- used for a one-off refresh
 * (e.g. reopening the workspace, or "View document"). The client's
 * primary progress signal while a document is actively processing is the
 * POST /process response, not polling this endpoint. originalText is
 * intentionally omitted: the client already holds it from the upload
 * response, and there's no reason to re-send a potentially large payload
 * on every check. */
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const document = await loadOwnedDocument(supabase, user.id, id);

    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      status: document.status,
      wordCount: document.word_count,
      charCount: document.char_count,
      pageCount: document.page_count,
      pageCountIsEstimate: document.page_count_is_estimate,
      chunkCount: document.chunk_count,
      chunksCompleted: document.chunks_completed,
      resultText: document.status === "ready" ? document.result_text : null,
      errorMessage: document.status === "failed" ? document.error_message : null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    // Confirms ownership (and turns "someone else's document" into a 404
    // rather than a silently no-op delete) before deleting.
    await loadOwnedDocument(supabase, user.id, id);

    // document_chunks rows cascade-delete via their document_id foreign
    // key (see supabase/schema.sql) -- no separate chunk cleanup needed.
    const { error } = await supabase.from("documents").delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      console.error("Failed to delete document:", error);
      throw error;
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
