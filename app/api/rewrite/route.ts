import { MODE_CONFIG } from "@/lib/server/mode-config";
import { resolveVoiceProfile, type VoiceProfile } from "@/lib/server/voice-profiles";
import { getProvider, MODEL_CONFIG, resolveActiveModelName } from "@/lib/server/model-config";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limiter";
import { recordUsage } from "@/lib/server/usage-tracker";
import { CONTROL_CHAR_PATTERN, parseRewriteRequest } from "@/lib/server/validation";
import { RateLimitError, ValidationError, toErrorResponse } from "@/lib/server/errors";
import { createClient } from "@/lib/supabase/server";
import type { AiModelId, LanguageId, ModeId } from "@/lib/modes";

export const runtime = "nodejs";

// Written into the stream only when generation fails partway through --
// after some real text has already reached the client, so the HTTP
// status and headers are already committed and a JSON error response is
// no longer possible. Chosen to be something a real rewrite could never
// contain. The client strips everything from this marker onward and
// shows a "partial result, connection interrupted" notice instead of
// silently presenting the cut-off text as the finished rewrite.
export const STREAM_ERROR_MARKER = "\u0000NXTIAI_STREAM_ERROR\u0000";

// Global twin of validation.ts's CONTROL_CHAR_PATTERN (that one is used
// with .test() on a whole string; streaming needs a global .replace()
// per chunk instead) -- same character class, applied per chunk instead
// of once at the end, so a runaway/garbage response still gets sanitized
// without buffering the whole thing first.
const STRIP_CONTROL_CHARS = new RegExp(CONTROL_CHAR_PATTERN.source, "g");

export async function POST(request: Request): Promise<Response> {
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
    const generator = provider.rewriteStream({
      text: parsed.text,
      mode,
      modeConfig,
      voice,
      voiceProfile,
      aiModel,
      modelConfig,
      language,
    });

    // Pull the first piece of real output before committing to a streamed
    // response. Any failure that happens before the provider has produced
    // a single character (bad API key, rate limit, quota, timeout, empty
    // result) rejects this call and falls through to the catch block
    // below, returning the exact same JSON error response as before
    // streaming existed. Only once real content is confirmed do we switch
    // to a stream -- a Response, once started, can't change its status.
    const first = await generator.next();
    if (first.done) {
      throw new Error("Rewrite provider produced no output.");
    }

    const maxLength = parsed.text.length * 6 + 200;
    const encoder = new TextEncoder();
    let fullText = first.value;

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(first.value));

        let truncated = false;
        try {
          while (true) {
            const next = await generator.next();
            if (next.done) break;
            if (truncated) continue; // draining the generator only, nothing more to send

            const clean = next.value.replace(STRIP_CONTROL_CHARS, "");
            fullText += clean;

            if (fullText.length > maxLength) {
              // Runaway/looping generation -- stop sending further chunks
              // rather than rejecting outright; everything sent so far was
              // legitimate output the user already sees.
              truncated = true;
              continue;
            }

            controller.enqueue(encoder.encode(clean));
          }
        } catch (error) {
          console.error("Rewrite stream failed mid-generation:", error);
          controller.enqueue(
            encoder.encode(STREAM_ERROR_MARKER + "Connection to the AI provider was interrupted.")
          );
        }

        const latencyMs = Date.now() - startedAt;
        const result = fullText.trim();

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
        if (user && result) {
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

        controller.close();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Model": resolveActiveModelName(aiModel),
        // Tells Vercel/any intermediate proxy that respects it not to
        // buffer the response -- chunks should reach the client as
        // they're produced, not once the whole response ends.
        "X-Accel-Buffering": "no",
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
