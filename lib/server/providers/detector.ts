import { GoogleGenAI, ApiError } from "@google/genai";
import { UpstreamProviderError } from "../errors";

/**
 * AI-text-likelihood estimation.
 *
 * Same GoogleGenAI client pattern as gemini-provider.ts (server-only,
 * key read once from process.env.GEMINI_API_KEY, never logged or sent to
 * the client), but non-streaming: this returns a single small JSON verdict,
 * not a long rewrite, so there's nothing to stream.
 *
 * Honesty matters more than confidence here: AI-text detection is not a
 * solved problem for any vendor, human or automated. This is always
 * presented (in the prompt, in the returned copy, and in the UI) as an
 * estimate, never a verified fact.
 */

const MODEL_NAME_FALLBACK = "gemini-3.6-flash";
const REQUEST_TIMEOUT_MS = 20_000;

export interface DetectionResult {
  aiLikelihoodPercent: number;
  verdict: "Likely human-written" | "Mixed / uncertain" | "Likely AI-generated";
  explanation: string;
  isEstimate: true;
}

function redact(message: string): string {
  const key = process.env.GEMINI_API_KEY;
  return key ? message.split(key).join("[redacted]") : message;
}

function mapDetectorError(error: unknown): never {
  if (error instanceof UpstreamProviderError) throw error;

  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    console.error(`[detector] request aborted after ${REQUEST_TIMEOUT_MS}ms timeout`);
    throw new UpstreamProviderError("The AI detector took too long to respond. Please try again.");
  }

  if (error instanceof ApiError) {
    console.error(
      "[detector] request failed: status=" + error.status + " message=" + redact(error.message)
    );
  } else {
    console.error("[detector] request failed:", error instanceof Error ? redact(error.message) : "unknown error");
  }

  throw new UpstreamProviderError(
    error instanceof ApiError
      ? `AI detector error (status ${error.status}). ${redact(error.message)}`
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
      "Estimated from sentence-length uniformity in this development environment (no AI model configured). Connect GEMINI_API_KEY for a real estimate.",
    isEstimate: true,
  };
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new UpstreamProviderError();
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export async function detectAiText(text: string): Promise<DetectionResult> {
  if (!process.env.GEMINI_API_KEY) {
    return mockDetect(text);
  }

  try {
    const response = await getClient().models.generateContent({
      model: MODEL_NAME_FALLBACK,
      contents:
        "Analyze the following text and estimate the likelihood it was written by an AI " +
        "language model rather than a human. Weigh sentence-length variation, word-choice " +
        "predictability, structural repetition, and natural imperfection. Be honest that " +
        "this is an estimate, not a certainty -- no detector, automated or human, can verify " +
        "authorship with full confidence.\n\nText:\n\"\"\"\n" +
        text +
        '\n"""',
      config: {
        systemInstruction:
          "You are a careful, calibrated AI-text-likelihood estimator. Respond only with JSON " +
          "matching the given schema. aiLikelihoodPercent is an integer 0-100. explanation is " +
          "2-3 short sentences a non-technical person can follow, always phrased as an estimate.",
        temperature: 0.2,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            aiLikelihoodPercent: { type: "number" },
            explanation: { type: "string" },
          },
          required: ["aiLikelihoodPercent", "explanation"],
        },
      },
    });

    const raw = response.text;
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
