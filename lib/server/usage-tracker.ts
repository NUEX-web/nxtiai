import type { AiModelId, LanguageId, ModeId } from "@/lib/modes";

/**
 * Usage tracking architecture.
 *
 * Development-safe no-op logging today (console.log). This is the seam
 * that will later feed billing/plan-limit enforcement (Free vs Pro vs
 * Business rewrite quotas) and analytics — swapping this for a database
 * write or an analytics pipeline call means changing only the body of
 * `recordUsage`, never its call site in the route handler.
 *
 * Intentionally fire-and-forget: a logging failure must never break a
 * rewrite response.
 */
export interface UsageEvent {
  mode?: ModeId;
  // string, not VoiceId: voice-profiles.ts also resolves arbitrary
  // Supabase-backed custom voice ids (see resolveVoiceProfile), so this
  // field is no longer limited to the built-in VoiceId union.
  voice?: string;
  aiModel?: AiModelId;
  language?: LanguageId;
  inputLength: number;
  outputLength: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
}

export function recordUsage(event: UsageEvent): void {
  try {
    console.log("[usage]", JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
  } catch {
    // Never let logging failures affect the response.
  }
}
