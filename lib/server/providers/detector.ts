import OpenAI, { APIError } from "openai";
import { UpstreamProviderError } from "../errors";

/**
 * AI-text-likelihood estimation.
 *
 * Same OpenAI client pattern as openai-provider.ts (server-only, key read
 * once from process.env.OPENAI_API_KEY, never logged or sent to the
 * client), but non-streaming: this returns a single small JSON verdict,
 * not a long rewrite, so there's nothing to stream. Uses the Chat
 * Completions API's structured-output support (response_format:
 * json_schema, strict mode) instead of Gemini's responseSchema -- same
 * idea, different SDK shape.
 *
 * Honesty matters more than confidence here: AI-text detection is not a
 * solved problem for any vendor, human or automated. This is always
 * presented (in the prompt, in the returned copy, and in the UI) as an
 * estimate, never a verified fact.
 */

const MODEL_NAME_FALLBACK = "gpt-5.6-luna";
const REQUEST_TIMEOUT_MS = 20_000;

export interface DetectionResult {
  aiLikelihoodPercent: number;
  verdict: "Likely human-written" | "Mixed / uncertain" | "Likely AI-generated";
  explanation: string;
  isEstimate: true;
}

function redact(message: string): string {
  const key = process.env.OPENAI_API_KEY;
  return key ? message.split(key).join("[redacted]") : message;
}

function mapDetectorError(error: unknown): never {
  if (error instanceof UpstreamProviderError) throw error;

  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    console.error(`[detector] request aborted after ${REQUEST_TIMEOUT_MS}ms timeout`);
    throw new UpstreamProviderError("The AI detector took too long to respond. Please try again.");
  }

  if (error instanceof APIError) {
    console.error(
      "[detector] request failed: status=" + error.status + " message=" + redact(error.message ?? "")
    );
  } else {
    console.error("[detector] request failed:", error instanceof Error ? redact(error.message) : "unknown error");
  }

  throw new UpstreamProviderError(
    error instanceof APIError
      ? `AI detector error (status ${error.status}). ${redact(error.message ?? "")}`
      : "The AI detector returned an unexpected response."
  );
}

function verdictFor(pct: number): DetectionResult["verdict"] {
  if (pct >= 66) return "Likely AI-generated";
  if (pct >= 34) return "Mixed / uncertain";
  return "Likely human-written";
}

/**
 * Development/no-key fallback. A crude but deterministic heuristic
 * (sentence-length uniformity + average sentence length) -- never a
 * real detector, but keeps the feature functional in dev the same way
 * MockRewriteProvider keeps the writer tool functional without a key.
 */
function mockDetect(text: string): DetectionResult {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const spread = lengths.length > 1 ? Math.max(...lengths) - Math.min(...lengths) : avgLen;
  const uniformity = 1 - Math.min(1, spread / (avgLen * 2 + 1));
  const pct = Math.max(5, Math.min(95, Math.round(uniformity * 55 + (avgLen > 18 ? 25 : 5))));

  return {
    aiLikelihoodPercent: pct,
    verdict: verdictFor(pct),
    explanation:
      "Estimated from sentence-length uniformity in this development environment (no AI model configured). Connect OPENAI_API_KEY for a real estimate.",
    isEstimate: true,
  };
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new UpstreamProviderError();
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function detectAiText(text: string): Promise<DetectionResult> {
  if (!process.env.OPENAI_API_KEY) {
    return mockDetect(text);
  }

  try {
    const response = await getClient().chat.completions.create(
      {
        model: MODEL_NAME_FALLBACK,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a careful, calibrated AI-text-likelihood estimator. Respond only with JSON " +
              "matching the given schema. aiLikelihoodPercent is an integer 0-100. explanation is " +
              "2-3 short sentences a non-technical person can follow, always phrased as an estimate.",
          },
          {
            role: "user",
            content:
              "Analyze the following text and estimate the likelihood it was written by an AI " +
              "language model rather than a human. Weigh sentence-length variation, word-choice " +
              "predictability, structural repetition, and natural imperfection. Be honest that " +
              "this is an estimate, not a certainty -- no detector, automated or human, can verify " +
              "authorship with full confidence.\n\nText:\n\"\"\"\n" +
              text +
              '\n"""',
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ai_detection_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                aiLikelihoodPercent: { type: "number" },
                explanation: { type: "string" },
              },
              required: ["aiLikelihoodPercent", "explanation"],
              additionalProperties: false,
            },
          },
        },
      },
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
    );

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new UpstreamProviderError("The AI detector returned an empty result.");

    let parsed: { aiLikelihoodPercent: number; explanation: string };
    try {
      parsed = JSON.parse(raw) as { aiLikelihoodPercent: number; explanation: string };
    } catch {
      throw new UpstreamProviderError("The AI detector returned an invalid result.");
    }

    const pct = Math.max(0, Math.min(100, Math.round(Number(parsed.aiLikelihoodPercent) || 0)));
    return {
      aiLikelihoodPercent: pct,
      verdict: verdictFor(pct),
      explanation: parsed.explanation || "No explanation returned.",
      isEstimate: true,
    };
  } catch (error) {
    mapDetectorError(error);
  }
}
