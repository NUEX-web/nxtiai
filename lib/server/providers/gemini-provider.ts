import { GoogleGenAI, ApiError } from "@google/genai";
import { LANGUAGE_OPTIONS } from "@/lib/modes";
import { UpstreamProviderError } from "../errors";
import type { ResolvedRewriteRequest, RewriteProvider } from "../model-config";

/**
 * Real AI provider backed by Google's Gemini API via the official
 * @google/genai SDK. Implements the same RewriteProvider interface as
 * MockRewriteProvider - nothing upstream of getProvider() (the route
 * handler, validation, mode/voice resolution) knows or cares which
 * concrete provider is behind the call.
 *
 * SECURITY:
 * - The API key is read once, server-side only, from process.env.GEMINI_API_KEY.
 * - It is never logged, never included in a thrown error, and never sent
 *   to the client in any response.
 * - This file is never imported by client components, only by
 *   lib/server/model-config.ts, which is only ever imported by the
 *   server-only app/api/rewrite/route.ts.
 */

const MODEL_NAME_FALLBACK = "gemini-3.6-flash";

/**
 * Hard ceiling on how long a single Gemini request may run.
 *
 * Without this, a slow/stuck upstream call can leave the client's "Rewrite"
 * button spinning indefinitely with no way to recover short of reloading --
 * the server-side call never resolves, so nothing (rate limiter, error
 * handler, UI) ever gets to run. Aborting past this point lets the request
 * fail loudly with a real, honest error instead of hanging. This bounds
 * the whole stream, not just the time-to-first-chunk -- a generation that
 * starts fine but stalls partway through still gets cut off.
 *
 * Was 30_000. Raised after production logs showed legitimate document-
 * processing chunks (2,800-4,600 chars, well under this pipeline's own
 * per-chunk cap) being killed by this exact timeout with zero output ever
 * streamed back -- i.e. Gemini hadn't necessarily failed, our own abort
 * fired before it had a real chance to respond. The serverless function
 * this runs in allows up to 300s (see functionMaxDuration in the Vercel
 * project), so 30s was leaving the vast majority of that budget unused
 * while aborting calls that may well have succeeded given more time. 90s
 * gives real headroom while still failing loudly well short of the
 * platform ceiling, and still bounds the whole stream, not just
 * time-to-first-chunk. If requests keep timing out even at 90s, that
 * points to an actual upstream Gemini slowdown/degradation rather than
 * this ceiling being too tight.
 */
const REQUEST_TIMEOUT_MS = 90_000;

function languageName(languageId: string): string {
  return LANGUAGE_OPTIONS.find((option) => option.id === languageId)?.label ?? languageId;
}

/** Strips the API key out of any string before it is ever logged. */
function redact(message: string): string {
  const key = process.env.GEMINI_API_KEY;
  return key ? message.split(key).join("[redacted]") : message;
}

function buildSystemInstruction(request: ResolvedRewriteRequest): string {
  const { modeConfig, voiceProfile, language } = request;

  const lines = [
    "You are NXTIAI, a professional writing assistant. Rewrite the user's text according to these instructions:",
    "- Writing mode: " + modeConfig.directive,
    "- Tone: " + voiceProfile.tone,
    "- Vocabulary level: " + voiceProfile.vocabularyLevel,
    "- Formality: " + voiceProfile.formality,
  ];

  if (voiceProfile.customInstructions) {
    lines.push("- Additional voice instructions: " + voiceProfile.customInstructions);
  }

  lines.push(
    "- Write the entire result in " + languageName(language) + ", regardless of the input language.",
    "- Preserve the original meaning unless the writing mode explicitly calls for expanding, shortening, or simplifying the text.",
    "- Return only the rewritten text. No preamble, no explanation, no quotation marks around the result."
  );

  return lines.join("\n");
}

/**
 * Maps any error from the Gemini SDK to a clear, actionable
 * UpstreamProviderError and throws it. Shared between stream setup and
 * mid-stream iteration so both failure points get identical, already-
 * verified error messages instead of two copies drifting apart.
 *
 * AbortSignal.timeout() rejects with a DOMException named "TimeoutError"
 * (also matches a manually aborted fetch's "AbortError" as a defensive
 * fallback). ApiError carries an HTTP status (401/403 = bad key or API
 * not enabled, 404 = model not found/unavailable for this key, 429 =
 * quota) which is the single most useful diagnostic signal here. Raw SDK
 * errors (which may include request metadata) are never surfaced to the
 * client -- only a redacted, generic trace goes to the server log.
 */
function mapGeminiError(error: unknown): never {
  if (error instanceof UpstreamProviderError) {
    throw error;
  }

  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    console.error(`[gemini-provider] request aborted after ${REQUEST_TIMEOUT_MS}ms timeout`);
    throw new UpstreamProviderError("The AI provider took too long to respond. Please try again.");
  }

  if (error instanceof ApiError) {
    console.error(
      "[gemini-provider] request failed: status=" + error.status + " message=" + redact(error.message)
    );
  } else {
    console.error(
      "[gemini-provider] request failed:",
      error instanceof Error ? redact(error.message) : "unknown error"
    );
  }

  throw new UpstreamProviderError(
    error instanceof ApiError
      ? `Gemini API error (status ${error.status}). ${redact(error.message)}`
      : error instanceof Error
        ? redact(error.message)
        : "Unknown Gemini error."
  );
}

export class GeminiRewriteProvider implements RewriteProvider {
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Defense in depth: getProvider() should never route here without a
        // key configured, but never proceed to construct a client without one.
        throw new UpstreamProviderError();
      }
      this.client = new GoogleGenAI({ apiKey: apiKey });
    }
    return this.client;
  }

  async *rewriteStream(request: ResolvedRewriteRequest): AsyncGenerator<string, void, unknown> {
    const modelName = request.modelConfig.model || MODEL_NAME_FALLBACK;

    let stream: AsyncGenerator<{ text?: string }>;
    try {
      const client = this.getClient();
      stream = await client.models.generateContentStream({
        model: modelName,
        contents: request.text,
        config: {
          systemInstruction: buildSystemInstruction(request),
          temperature: request.modelConfig.temperature,
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      });
    } catch (error) {
      mapGeminiError(error);
    }

    // No special-casing for "failed before vs. after some output" here --
    // mapGeminiError() always throws the same way regardless of how much
    // (if any) real text was already yielded. It's the caller (the route
    // handler) that decides what to do with a rejection depending on
    // whether it happens on the very first pull (still safe to return a
    // normal JSON error response) or a later one (a stream already
    // committed to the client, handled there with an in-band marker).
    let yieldedAny = false;
    try {
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          yieldedAny = true;
          yield text;
        }
      }
    } catch (error) {
      mapGeminiError(error);
    }

    if (!yieldedAny) {
      throw new UpstreamProviderError("The writing provider returned an empty result.");
    }
  }
}
