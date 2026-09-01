import { z } from "zod";
import { isKnownMode } from "./mode-config";
import { isKnownVoice } from "./voice-profiles";
import { isKnownModel } from "./model-config";
import { LANGUAGE_OPTIONS } from "@/lib/modes";
import { UpstreamProviderError, ValidationError } from "./errors";

const TEXT_MAX_LENGTH = 5000;
const LANGUAGE_IDS = LANGUAGE_OPTIONS.map((option) => option.id);

/**
 * Request validation.
 *
 * Every enum field is checked against the server's own config modules
 * (mode-config / voice-profiles / model-config), never trusted from the
 * client — a client sending an unknown or forged id fails validation
 * before it ever reaches mode/voice/model resolution.
 */
export const rewriteRequestSchema = z.object({
  text: z
    .string({ error: "text is required." })
    .trim()
    .min(1, "Enter some text before rewriting.")
    .max(TEXT_MAX_LENGTH, `Text must be ${TEXT_MAX_LENGTH} characters or fewer.`),
  mode: z.string({ error: "mode is required." }).refine(isKnownMode, {
    error: "Unknown writing mode.",
  }),
  voice: z.string({ error: "voice is required." }).refine(isKnownVoice, {
    error: "Unknown voice.",
  }),
  aiModel: z.string({ error: "aiModel is required." }).refine(isKnownModel, {
    error: "Unknown AI model.",
  }),
  language: z
    .string({ error: "language is required." })
    .refine((value) => LANGUAGE_IDS.includes(value as (typeof LANGUAGE_IDS)[number]), {
      error: "Unknown language.",
    }),
});

export type RewriteRequestInput = z.infer<typeof rewriteRequestSchema>;

export function parseRewriteRequest(body: unknown): RewriteRequestInput {
  const result = rewriteRequestSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid request.");
  }
  return result.data;
}

/**
 * Response validation.
 *
 * Applied to every provider response — mock today, a real model later —
 * before it reaches the client. Catches empty output, runaway/garbage
 * length, and stray control characters rather than passing them through.
 */
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000e-\u001f]/;

export function validateProviderResponse(result: string, inputText: string): string {
  const trimmed = result.trim();

  if (!trimmed) {
    throw new UpstreamProviderError("The writing provider returned an empty result.");
  }

  const maxLength = inputText.length * 6 + 200;
  if (trimmed.length > maxLength) {
    throw new UpstreamProviderError("The writing provider returned an unexpectedly long result.");
  }

  if (CONTROL_CHAR_PATTERN.test(trimmed)) {
    throw new UpstreamProviderError("The writing provider returned an invalid result.");
  }

  return trimmed;
}
