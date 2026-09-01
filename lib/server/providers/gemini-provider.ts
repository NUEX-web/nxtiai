import { GoogleGenAI, ApiError } from "@google/genai";
import { LANGUAGE_OPTIONS } from "@/lib/modes";
import { UpstreamProviderError } from "../errors";
import type { ProviderResult, ResolvedRewriteRequest, RewriteProvider } from "../model-config";

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
 * button spinning indefinitely with no way to recover short of reloading —
 * the server-side call never resolves, so nothing (rate limiter, error
 * handler, UI) ever gets to run. Aborting past this point lets the request
 * fail loudly with a real, honest error instead of hanging.
 */
const REQUEST_TIMEOUT_MS = 30_000;

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

  async rewrite(request: ResolvedRewriteRequest): Promise<ProviderResult> {
    const modelName = request.modelConfig.model || MODEL_NAME_FALLBACK;

    try {
      const client = this.getClient();
      const response = await client.models.generateContent({
        model: modelName,
        contents: request.text,
        config: {
          systemInstruction: buildSystemInstruction(request),
          temperature: request.modelConfig.temperature,
          // AbortSignal.timeout rejects the call once REQUEST_TIMEOUT_MS
          // elapses, surfacing as a DOMException with name "TimeoutError"
          // (caught and mapped to a clear message below) rather than
          // leaving the request pending forever.
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      });

      const text = response.text;
      if (!text) {
        throw new UpstreamProviderError("The writing provider returned an empty result.");
      }

      return { result: text };
    } catch (error) {
      if (error instanceof UpstreamProviderError) {
        throw error;
      }

      // AbortSignal.timeout() rejects with a DOMException named
      // "TimeoutError" (also matches a manually aborted fetch's
      // "AbortError" as a defensive fallback) — map it to a clear,
      // actionable message instead of falling through to the generic
      // "unknown error" branch below.
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        console.error(
          `[gemini-provider] request aborted after ${REQUEST_TIMEOUT_MS}ms timeout`
        );
        throw new UpstreamProviderError(
          "The AI provider took too long to respond. Please try again."
        );
      }

      // Never surface raw SDK errors (which may include request metadata)
      // to the client - log a redacted, generic trace server-side only.
      // ApiError carries an HTTP status (401/403 = bad key or API not
      // enabled, 404 = model not found/unavailable for this key, 429 =
      // quota) which is the single most useful diagnostic signal here.
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
  }
}
