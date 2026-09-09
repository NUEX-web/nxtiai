/**
 * Splits an extracted document into ordered, size-bounded chunks for
 * sequential AI processing (see app/api/documents/[id]/process/route.ts).
 *
 * Rules, in priority order:
 *  1. Never split a paragraph unless it alone exceeds maxChars.
 *  2. When a paragraph must split, split on sentence boundaries.
 *  3. Only when a single "sentence" alone exceeds maxChars (no punctuation
 *     for a very long stretch -- pathological, but must not crash or
 *     infinite-loop) fall back to a hard split on the nearest word
 *     boundary at or before the limit.
 * Original order is always preserved via the chunk's index.
 */

export interface DocumentChunk {
  index: number;
  text: string;
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"'‘“(])/;

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitIntoSentences(paragraph: string): string[] {
  const parts = paragraph.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [paragraph];
}

/** Last-resort split for a single "sentence" longer than maxChars: cuts at
 * the last word boundary at or before the limit so we never split mid-word,
 * and always makes forward progress even on a string with no whitespace at
 * all (falls back to a hard character cut) so this can never loop forever. */
function hardSplit(text: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf(" ", maxChars);
    if (cut <= 0) cut = maxChars;
    pieces.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

/** Breaks a single oversized paragraph into maxChars-safe pieces, packing
 * consecutive sentences together (rather than one sentence per piece) so
 * chunk count stays proportional to size, not sentence count. */
function packParagraph(paragraph: string, maxChars: number): string[] {
  const sentences = splitIntoSentences(paragraph).flatMap((sentence) =>
    sentence.length > maxChars ? hardSplit(sentence, maxChars) : [sentence]
  );

  const pieces: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxChars && current) {
      pieces.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export function chunkDocument(text: string, maxChars: number): DocumentChunk[] {
  const safeMax = Math.max(200, maxChars); // sanity floor, never a degenerate 0/negative cap
  const paragraphs = splitIntoParagraphs(text);

  const pieces: string[] = [];
  let current = "";

  const flush = () => {
    if (current) {
      pieces.push(current);
      current = "";
    }
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > safeMax) {
      flush();
      pieces.push(...packParagraph(paragraph, safeMax));
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > safeMax && current) {
      flush();
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  flush();

  return pieces.map((text, index) => ({ index, text }));
}

/** Reassembles processed chunk outputs back into one document, in order.
 * Chunks were split on paragraph (or sentence, for oversized paragraphs)
 * boundaries, so joining with a blank line between every chunk keeps the
 * result readable without needing to track which joins were mid-paragraph. */
export function joinChunkResults(results: string[]): string {
  return results.map((r) => r.trim()).filter(Boolean).join("\n\n");
}
