import { WRITING_MODES, type ModeId } from "@/lib/modes";

/**
 * Server-authoritative mode configuration.
 *
 * lib/modes.ts holds the *labels and descriptions* the UI displays.
 * This file holds the *directives* a rewrite engine acts on. Today the
 * mock provider mostly ignores these fields (its transform logic is
 * mode-keyed directly in lib/mock-ai.ts) — but this is the object a real
 * model's prompt-construction step will consume in the future, so the
 * shape is designed for that now rather than retrofitted later.
 */
export interface ModeConfig {
  /** Short natural-language instruction a real model would receive. */
  directive: string;
  /** Relative target formality, used for prompt tuning later. */
  formality: "low" | "neutral" | "high";
  /** Expected output length relative to input (1 = same length). */
  lengthMultiplier: number;
}

export const MODE_CONFIG: Record<ModeId, ModeConfig> = {
  standard: { directive: "Rewrite clearly and naturally without changing meaning.", formality: "neutral", lengthMultiplier: 1 },
  academic: { directive: "Rewrite formally and precisely, suitable for academic writing.", formality: "high", lengthMultiplier: 1.1 },
  professional: { directive: "Rewrite in a polished, professional register.", formality: "high", lengthMultiplier: 1 },
  creative: { directive: "Rewrite with vivid, expressive phrasing.", formality: "neutral", lengthMultiplier: 1.1 },
  simple: { directive: "Rewrite in plain language with shorter sentences.", formality: "low", lengthMultiplier: 0.8 },
  expand: { directive: "Rewrite with added detail and supporting context.", formality: "neutral", lengthMultiplier: 1.6 },
  shorten: { directive: "Rewrite to the essential point, as concisely as possible.", formality: "neutral", lengthMultiplier: 0.6 },
  humanize: { directive: "Rewrite so it reads naturally, like a person wrote it.", formality: "low", lengthMultiplier: 1 },
  "legal-simplifier": { directive: "Rewrite contract-style language in plain English.", formality: "neutral", lengthMultiplier: 1 },
  email: { directive: "Rewrite as a short, well-structured email.", formality: "high", lengthMultiplier: 1.2 },
};

/** Source of truth for "is this a real mode id" — used by request validation. */
export function isKnownMode(value: string): value is ModeId {
  return Object.prototype.hasOwnProperty.call(MODE_CONFIG, value);
}

// Fails fast in dev if lib/modes.ts and this file ever drift apart.
if (WRITING_MODES.some((mode) => !isKnownMode(mode.id))) {
  throw new Error("MODE_CONFIG is missing an entry present in WRITING_MODES.");
}
