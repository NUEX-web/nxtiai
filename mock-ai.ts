import type { ModeId } from "./modes";

/**
 * Mock AI rewriting layer.
 *
 * This is a development stand-in only — no external model is called.
 * It applies a handful of deterministic text transformations so the
 * writing workspace has something real to show while the product's
 * actual inference backend is not yet connected.
 */

const CONTRACTION_MAP: [RegExp, string][] = [
  [/\bI am\b/g, "I'm"],
  [/\bdo not\b/gi, "don't"],
  [/\bcan not\b/gi, "can't"],
  [/\bcannot\b/gi, "can't"],
  [/\bwill not\b/gi, "won't"],
  [/\bit is\b/gi, "it's"],
  [/\bthat is\b/gi, "that's"],
];

const FORMAL_MAP: [RegExp, string][] = [
  [/\bI'm\b/g, "I am"],
  [/\bdon't\b/gi, "do not"],
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bit's\b/gi, "it is"],
  [/\bthat's\b/gi, "that is"],
  [/\bget\b/gi, "obtain"],
  [/\basked\b/gi, "requested"],
];

const FILLER_TRIMS: RegExp[] = [
  /\bI am writing to\b\s*/gi,
  /\bjust wanted to\b\s*/gi,
  /\bI wanted to\b\s*/gi,
  /\bkind of\b\s*/gi,
  /\bsort of\b\s*/gi,
  /\bvery\s+/gi,
  /\breally\s+/gi,
];

function applyMap(text: string, map: [RegExp, string][]): string {
  return map.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

function trimFillers(text: string): string {
  return FILLER_TRIMS.reduce((acc, pattern) => acc.replace(pattern, ""), text).trim();
}

function capitalizeFirst(text: string): string {
  return text.length ? text[0].toUpperCase() + text.slice(1) : text;
}

function transformForMode(input: string, mode: ModeId): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  switch (mode) {
    case "academic":
      return capitalizeFirst(
        `${applyMap(trimFillers(trimmed), FORMAL_MAP)}, as reflected in the surrounding context.`
      );
    case "professional":
      return capitalizeFirst(applyMap(trimFillers(trimmed), FORMAL_MAP));
    case "creative":
      return capitalizeFirst(`${trimFillers(trimmed)} — and it changes everything that follows.`);
    case "simple": {
      const shortened = trimFillers(trimmed).split(/(?<=[.!?])\s+/)[0];
      return capitalizeFirst(applyMap(shortened, CONTRACTION_MAP));
    }
    case "expand":
      return capitalizeFirst(
        `${trimFillers(trimmed)}. To add a little more context, this matters because it directly affects the outcome we're aiming for.`
      );
    case "shorten": {
      const words = trimFillers(trimmed).split(/\s+/);
      const shortened = words.slice(0, Math.max(6, Math.ceil(words.length * 0.6))).join(" ");
      return capitalizeFirst(applyMap(shortened, CONTRACTION_MAP)).replace(/[,;:]$/, "") + ".";
    }
    case "humanize":
      return capitalizeFirst(`${applyMap(trimFillers(trimmed), CONTRACTION_MAP)}, honestly.`);
    case "legal-simplifier":
      return capitalizeFirst(
        `In plain terms: ${applyMap(trimFillers(trimmed), FORMAL_MAP).toLowerCase()}.`
      );
    case "email":
      return `Hi,\n\n${capitalizeFirst(applyMap(trimFillers(trimmed), FORMAL_MAP))}\n\nBest regards`;
    case "standard":
    default:
      return capitalizeFirst(applyMap(trimFillers(trimmed), CONTRACTION_MAP));
  }
}

export interface MockRewriteOptions {
  mode: ModeId;
  /** Simulated network/inference latency in ms. */
  delayMs?: number;
}

export async function mockRewrite(
  input: string,
  { mode, delayMs = 650 }: MockRewriteOptions
): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (!input.trim()) {
    throw new Error("Enter some text before rewriting.");
  }

  const result = transformForMode(input, mode);

  // Fallback so the mock never silently returns the original text unchanged.
  if (result === input.trim()) {
    return `${result} (rewritten in ${mode.replace("-", " ")} mode)`;
  }

  return result;
}

export const EXAMPLE_ORIGINAL =
  "I am writing to ask if you could provide me with more information about the project.";

export const EXAMPLE_RESULT =
  "I'm reaching out to ask if you could share more information about the project.";
