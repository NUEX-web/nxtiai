import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "@/lib/server/errors";

/**
 * Row shape for public.documents (see supabase/schema.sql). Kept here
 * rather than generating full Supabase types, matching how the rest of
 * the codebase hand-writes row shapes next to the queries that use them.
 */
export interface DocumentRow {
  id: string;
  user_id: string;
  filename: string;
  file_extension: string;
  original_text: string;
  result_text: string | null;
  word_count: number;
  char_count: number;
  page_count: number;
  page_count_is_estimate: boolean;
  chunk_count: number;
  chunks_completed: number;
  mode: string;
  voice: string;
  ai_model: string;
  language: string;
  status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunkRow {
  id: string;
  document_id: string;
  user_id: string;
  chunk_index: number;
  input_text: string;
  output_text: string | null;
  status: "pending" | "done" | "failed";
  attempts: number;
  created_at: string;
}

/**
 * Loads a document scoped to its owner. RLS already prevents a signed-in
 * user's query from ever returning another user's row -- this explicit
 * .eq("user_id", ...) is defense-in-depth, and lets a mismatched id
 * collapse to the same generic 404 as a genuinely missing document,
 * rather than leaking whether the id exists at all.
 */
export async function loadOwnedDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  documentId: string
): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load document:", error);
    throw new NotFoundError();
  }
  if (!data) {
    throw new NotFoundError("Document not found.");
  }
  return data as DocumentRow;
}
