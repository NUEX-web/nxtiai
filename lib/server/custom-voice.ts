import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoiceProfile } from "./voice-profiles";

/**
 * Looks up a signed-in user's saved custom_voices row for a given voice
 * id, scoped to that user (never another user's voice). Shared by
 * app/api/rewrite (single-shot) and app/api/documents/[id]/process
 * (per-chunk, large-document pipeline) so the two call sites can never
 * drift on how a custom voice is resolved.
 *
 * Returns undefined for any built-in voice id (my-voice, professional,
 * academic, casual, business) -- those never hit the database -- or when
 * no matching row exists for this user.
 */
export async function loadCustomVoiceRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string | null | undefined,
  voice: string
): Promise<Partial<VoiceProfile> | undefined> {
  if (!userId || !voice) return undefined;
  if (["my-voice", "professional", "academic", "casual", "business"].includes(voice)) return undefined;

  const { data: dbVoice } = await supabase
    .from("custom_voices")
    .select("*")
    .eq("id", voice)
    .eq("user_id", userId)
    .single();

  if (!dbVoice) return undefined;

  return {
    label: dbVoice.name,
    tone: dbVoice.tone,
    formality: dbVoice.formality as "low" | "neutral" | "high",
    vocabularyLevel: dbVoice.vocabulary_level as "simple" | "standard" | "advanced",
    customInstructions: dbVoice.custom_instructions || undefined,
  };
}
