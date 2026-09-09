import { MODE_CONFIG } from "@/lib/server/mode-config";
import { resolveVoiceProfile } from "@/lib/server/voice-profiles";
import { getProvider, MODEL_CONFIG } from "@/lib/server/model-config";
import { validateProviderResponse } from "@/lib/server/validation";
import type { AiModelId, LanguageId, ModeId } from "@/lib/modes";

/**
 * Runs one document chunk through the exact same rewrite pipeline
 * /api/rewrite uses (MODE_CONFIG, resolveVoiceProfile, getProvider(...).
 * rewriteStream) -- the large-document pipeline is deliberately not a
 * second AI integration, just this pipeline invoked once per chunk
 * instead of once per request. The provider's own per-call timeout
 * (REQUEST_TIMEOUT_MS in gemini-provider.ts) bounds how long a single
 * chunk can take; failures are already generic AppErrors by the time
 * they reach here (see gemini-provider.ts's mapGeminiError), so nothing
 * document-specific needs to redact anything further.
 */
export async function processChunkText(params: {
  text: string;
  mode: ModeId;
  voice: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  voiceRecord: any;
  aiModel: AiModelId;
  language: LanguageId;
}): Promise<string> {
  const { text, mode, voice, voiceRecord, aiModel, language } = params;
  const voiceProfile = resolveVoiceProfile(voice, voiceRecord);
  const modeConfig = MODE_CONFIG[mode];
  const modelConfig = MODEL_CONFIG[aiModel];
  const provider = getProvider(aiModel);

  const generator = provider.rewriteStream({
    text,
    mode,
    modeConfig,
    voice,
    voiceProfile,
    aiModel,
    modelConfig,
    language,
  });

  let fullText = "";
  for await (const piece of generator) {
    fullText += piece;
  }

  return validateProviderResponse(fullText, text);
}
