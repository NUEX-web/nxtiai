import { NextResponse } from "next/server";
import { MODE_CONFIG } from "@/lib/server/mode-config";
import { resolveVoiceProfile, type VoiceProfile } from "@/lib/server/voice-profiles";
import { getProvider, MODEL_CONFIG, resolveActiveModelName } from "@/lib/server/model-config";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limiter";
import { recordUsage } from "@/lib/server/usage-tracker";
import { parseRewriteRequest, validateProviderResponse } from "@/lib/server/validation";
import { RateLimitError, ValidationError, toErrorResponse } from "@/lib/server/errors";
import { createClient } from "@/lib/supabase/server";
import type { AiModelId, LanguageId, ModeId } from "@/lib/modes";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const identifier = getClientIdentifier(request);
  let parsedForLogging: Partial<{ mode: ModeId; voice: string; aiModel: AiModelId; language: LanguageId; inputLength: number }> = {};

  try {
    const rate = checkRateLimit(identifier);
    if (!rate.allowed) {
      throw new RateLimitError(rate.retryAfterMs);
    }

    const rawBody: unknown = await request.json().catch(() => {
      throw new ValidationError("Request body must be valid JSON.");
    });

    const parsed = parseRewriteRequest(rawBody);
    const mode = parsed.mode as ModeId;
    const voice = parsed.voice;
    const aiModel = parsed.aiModel as AiModelId;
    const language = parsed.language as LanguageId;
    parsedForLogging = { mode, voice, aiModel, language, inputLength: parsed.text.length };

    const modeConfig = MODE_CONFIG[mode];

    // Supabase session & custom voice check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let customVoiceRecord: Partial<VoiceProfile> | undefined;
    if (user && voice && !["my-voice", "professional", "academic", "casual", "business"].includes(voice)) {
      const { data: dbVoice } = await supabase
        .from("custom_voices")
        .select("*")
        .eq("id", voice)
        .eq("user_id", user.id)
        .single();

      if (dbVoice) {
        customVoiceRecord = {
          label: dbVoice.name,
          tone: dbVoice.tone,
          formality: dbVoice.formality as "low" | "neutral" | "high",
          vocabularyLevel: dbVoice.vocabulary_level as "simple" | "standard" | "advanced",
          customInstructions: dbVoice.custom_instructions || undefined,
        };
      }
    }

    const voiceProfile = resolveVoiceProfile(voice, customVoiceRecord);
    const modelConfig = MODEL_CONFIG[aiModel];
    const provider = getProvider(aiModel);

    const startedAt = Date.now();
    const providerResult = await provider.rewrite({
      text: parsed.text,
      mode,
      modeConfig,
      voice,
      voiceProfile,
      aiModel,
      modelConfig,
      language,
    });
    const latencyMs = Date.now() - startedAt;

    const result = validateProviderResponse(providerResult.result, parsed.text);

    recordUsage({
      mode,
      voice,
      aiModel,
      language,
      inputLength: parsed.text.length,
      outputLength: result.length,
      latencyMs,
      success: true,
    });

    // Save to user history if logged in
    if (user) {
      supabase
        .from("rewrites_history")
        .insert({
          user_id: user.id,
          input_text: parsed.text,
          output_text: result,
          mode,
          voice,
          ai_model: aiModel,
          language,
          latency_ms: latencyMs,
        })
        .then(({ error }) => {
          if (error) console.error("Failed to insert rewrite history:", error);
        });
    }

    return NextResponse.json({
      result,
      mode,
      meta: {
        latencyMs,
        voice: voiceProfile.id,
        model: resolveActiveModelName(aiModel),
      },
    });
  } catch (error) {
    const response = toErrorResponse(error);
    recordUsage({
      ...parsedForLogging,
      inputLength: parsedForLogging.inputLength ?? 0,
      outputLength: 0,
      latencyMs: 0,
      success: false,
      errorCode: response.status.toString(),
    });
    return response;
  }
}
