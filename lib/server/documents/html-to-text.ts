/**
 * Converts mammoth's semantic HTML output (headings, paragraphs, lists,
 * line breaks) into plain text for NXTIAI's textarea-based editor, which
 * has no rich-text/markup rendering. This is the honest ceiling of
 * "preserve formatting" for a plain-text editor: structure survives as
 * paragraph breaks, list markers, and document order -- bold/italic/font
 * formatting does not, since there's nowhere in the UI to show it.
 *
 * Deliberately regex-based rather than pulling in a DOM/HTML-parsing
 * dependency: mammoth's output is simple, well-formed, flat-ish markup
 * (p / h1-h6 / ul,ol > li / br / inline emphasis tags), which a small
 * tolerant parser handles correctly without a new dependency.
 */

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#39|amp|lt|gt|quot|apos|nbsp|#\d+);/g, (match, entity: string) => {
    if (entity.startsWith("#") && entity !== "#39") {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : match;
    }
    return ENTITY_MAP[entity] ?? match;
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

interface Block {
  tag: string;
  text: string;
}

export function htmlToStructuredText(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n");

  const blocks: Block[] = [];
  const blockPattern = /<(h[1-6]|p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(withBreaks)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = decodeEntities(stripTags(match[2]))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
    if (inner) blocks.push({ tag, text: inner });
  }

  // Fallback: mammoth produced no recognized block tags (shouldn't
  // normally happen, but a malformed/unusual document must still produce
  // *something* rather than an empty result) -- strip all markup and
  // treat blank lines as paragraph breaks.
  if (blocks.length === 0) {
    return decodeEntities(stripTags(withBreaks))
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  const lines: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const previous = blocks[i - 1];
    const text = block.tag === "li" ? `- ${block.text}` : block.text;

    if (i === 0) {
      lines.push(text);
      continue;
    }

    // Consecutive list items stay tight (single newline); everything
    // else -- including the transition into/out of a list -- gets a
    // blank line, matching how a reader would expect paragraphs and
    // headings to be separated.
    const bothListItems = block.tag === "li" && previous?.tag === "li";
    lines.push(bothListItems ? "\n" + text : "\n\n" + text);
  }

  return lines.join("").trim();
}
