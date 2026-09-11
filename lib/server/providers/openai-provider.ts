import OpenAI, { APIError } from "openai";
import { LANGUAGE_OPTIONS } from "@/lib/modes";
import { UpstreamProviderError } from "../errors";
import type { ResolvedRewriteRequest, RewriteProvider } from "../model-config";

/**
 * Real AI provider backed by OpenAI's API via the official `openai` SDK.
 * Implements the same RewriteProvider interface as MockRewriteProvider and
 * GeminiRewriteProvider - nothing upstream of getProvider() (the route
 * handler, validation, mode/voice resolution) knows or cares which
 * concrete provider is behind the call.
 *
 * Mirrors gemini-provider.ts's structure deliberately -- same timeout
 * strategy, same error-redaction/mapping shape, same
 * "throw before yielding anything on outright failure" contract -- so the
 * two providers stay easy to compare and keep in sync.
 *
 * SECURITY:
 * - The API key is read once, server-side only, from process.env.OPENAI_API_KEY.
 * - It is never logged, never included in a thrown error, and never sent
 *   to the client in any response.
 * - This file is never imported by client components, only by
 *   lib/server/model-config.ts, which is only ever imported by the
 *   server-only app/api/rewrite/route.ts.
 */

const MODEL_NAME_FALLBACK = "gpt-5.6-luna";

/**
 * Hard ceiling on how long a single OpenAI request may run. Same reasoning
 * and same value as gemini-provider.ts's REQUEST_TIMEOUT_MS -- see that
 * file for the full write-up (the serverless function this runs in allows
 * up to 300s; 90s leaves real headroom while still failing loudly well
 * short of that ceiling). Bounds the whole stream, not just
 * time-to-first-chunk.
 */
const REQUEST_TIMEOUT_MS = 90_000;

function languageName(languageId: string): string {
  return LANGUAGE_OPTIONS.find((option) => option.id === languageId)?.label ?? languageId;
}

/** Strips the API key out of any string before it is ever logged. */
function redact(message: string): string {
  const key = process.env.OPENAI_API_KEY;
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
 * Maps any error from the OpenAI SDK to a clear, actionable
 * UpstreamProviderError and throws it. Shared between stream setup and
 * mid-stream iteration so both failure points get identical, already-
 * verified error messages instead of two copies drifting apart.
 *
 * AbortSignal.timeout() rejects with a DOMException named "TimeoutError"
 * (also matches a manually aborted fetch's "AbortError" as a defensive
 * fallback) -- checked first since the SDK may re-wrap it as a generic
 * APIError otherwise. APIError carries an HTTP status (401 = bad key,
 * 403 = no access to the model, 404 = unknown model, 429 = rate limit or
 * quota) which is the single most useful diagnostic signal here. Raw SDK
 * errors (which may include request metadata) are never surfaced to the
 * client -- only a redacted, generic trace goes to the server log.
 */
function mapOpenAIError(error: unknown): never {
  if (error instanceof UpstreamProviderError) {
    throw error;
  }

  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    console.error(`[openai-provider] request aborted after ${REQUEST_TIMEOUT_MS}ms timeout`);
    throw new UpstreamProviderError("The AI provider took too long to respond. Please try again.");
  }

  if (error instanceof APIError) {
    console.error(
      "[openai-provider] request failed: status=" + error.status + " message=" + redact(error.message ?? "")
    );
  } else {
    console.error(
      "[openai-provider] request failed:",
      error instanceof Error ? redact(error.message) : "unknown error"
    );
  }

  throw new UpstreamProviderError(
    error instanceof APIError
      ? `OpenAI API error (status ${error.status}). ${redact(error.message ?? "")}`
      : error instanceof Error
        ? redact(error.message)
        : "Unknown OpenAI error."
  );
}

export class OpenAIRewriteProvider implements RewriteProvider {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        // Defense in depth: getProvider() should never route here without a
        // key configured, but never proceed to construct a client without one.
        throw new UpstreamProviderError();
      }
      this.client = new OpenAI({ apiKey: apiKey });
    }
    return this.client;
  }

  async *rewriteStream(request: ResolvedRewriteRequest): AsyncGenerator<string, void, unknown> {
    const modelName = request.modelConfig.model || MODEL_NAME_FALLBACK;

    let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
    try {
      const client = this.getClient();
      stream = await client.chat.completions.create(
        {
          model: modelName,
          temperature: request.modelConfig.temperature,
          stream: true,
          messages: [
            { role: "system", content: buildSystemInstruction(request) },
            { role: "user", content: request.text },
          ],
        },
        { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
      );
    } catch (error) {
      mapOpenAIError(error);
    }

    // No special-casing for "failed before vs. after some output" here --
    // mapOpenAIError() always throws the same way regardless of how much
    // (if any) real text was already yielded. It's the caller (the route
    // handler) that decides what to do with a rejection depending on
    // whether it happens on the very first pull (still safe to return a
    // normal JSON error response) or a later one (a stream already
    // committed to the client, handled there with an in-band marker).
    let yieldedAny = false;
    try {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          yieldedAny = true;
          yield text;
        }
      }
    } catch (error) {
      mapOpenAIError(error);
    }

    if (!yieldedAny) {
      throw new UpstreamProviderError("The writing provider returned an empty result.");
    }
  }
}
