import { InternalError, ValidationError } from "@/lib/server/errors";
import { ESTIMATED_WORDS_PER_PAGE, type AcceptedExtension } from "./limits";
import { htmlToStructuredText } from "./html-to-text";

/**
 * Text extraction for the document-upload pipeline. One function per
 * supported format, all normalized to the same output shape so the rest
 * of the pipeline (chunk.ts, the upload route) never needs to know which
 * library produced the text.
 *
 * Every extractor throws ValidationError for a file that's genuinely bad
 * (corrupted, encrypted, empty) and InternalError for anything
 * unexpected -- both are already mapped to safe, generic client messages
 * by lib/server/errors.ts, so no provider/library name or stack trace
 * ever reaches the response.
 */
export interface ExtractionResult {
  text: string;
  /** Exact for PDF (read from the file itself). Estimated for every other
   * format, since DOCX/DOC/TXT have no native page concept. */
  pageCount: number;
  pageCountIsEstimate: boolean;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function estimatedPages(text: string): number {
  return Math.max(1, Math.ceil(countWords(text) / ESTIMATED_WORDS_PER_PAGE));
}

/** Collapses PDF.js's per-visual-line text output into paragraphs: a
 * single newline (line wrap inside a paragraph) becomes a space, while
 * two or more newlines (an actual paragraph break) are preserved. Also
 * caps runs of 3+ blank lines down to one, so a document with lots of
 * whitespace doesn't inflate the chunk count. */
function normalizePdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  // pdf-parse's default CanvasFactory (DOMCanvasFactory) is browser-only --
  // it touches DOMMatrix, which doesn't exist in the Node.js serverless
  // runtime and crashes every PDF upload with "ReferenceError: DOMMatrix is
  // not defined" the moment pdf-parse is used. pdf-parse/worker ships a
  // Node-compatible CanvasFactory (backed by @napi-rs/canvas) for exactly
  // this case; it must be imported and passed explicitly, since it isn't
  // the default. See next.config.ts's serverExternalPackages for the other
  // half of this fix (keeping pdf-parse out of Turbopack's bundle so this
  // actually resolves at runtime instead of being inlined).
  const [{ PDFParse }, { CanvasFactory }] = await Promise.all([import("pdf-parse"), import("pdf-parse/worker")]);
  const parser = new PDFParse({ data: new Uint8Array(buffer), CanvasFactory });
  try {
    const result = await parser.getText();
    const text = normalizePdfText(result.text ?? "");
    if (!text) {
      throw new ValidationError(
        "This PDF doesn't contain any extractable text (it may be a scanned image). Try a text-based PDF, DOCX, or TXT file instead."
      );
    }
    return { text, pageCount: result.total || estimatedPages(text), pageCountIsEstimate: false };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(
      "This PDF couldn't be read -- it may be corrupted, password-protected, or in an unsupported format."
    );
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const mammoth = await import("mammoth");
  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value;
  } catch {
    throw new ValidationError("This DOCX file couldn't be read -- it may be corrupted or in an unsupported format.");
  }

  const text = htmlToStructuredText(html);
  if (!text) {
    throw new ValidationError("This document doesn't contain any readable text.");
  }
  return { text, pageCount: estimatedPages(text), pageCountIsEstimate: true };
}

async function extractDoc(buffer: Buffer): Promise<ExtractionResult> {
  const WordExtractor = (await import("word-extractor")).default;
  const extractor = new WordExtractor();
  let body: string;
  try {
    const document = await extractor.extract(buffer);
    body = document.getBody();
  } catch {
    throw new ValidationError(
      "This .doc file couldn't be read -- it may be corrupted, password-protected, or in an unsupported format."
    );
  }

  const text = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new ValidationError("This document doesn't contain any readable text.");
  }
  return { text, pageCount: estimatedPages(text), pageCountIsEstimate: true };
}

/** Plain text upload. Handles a UTF-8 BOM and normalizes line endings;
 * falls back to latin1 decoding only if the bytes aren't valid UTF-8, so
 * a non-UTF-8 .txt file still comes through as readable text rather than
 * being rejected outright. */
function extractTxt(buffer: Buffer): ExtractionResult {
  let text = buffer.toString("utf-8");
  if (text.includes("�") && !buffer.toString("latin1").includes("�")) {
    text = buffer.toString("latin1");
  }
  text = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

  if (!text) {
    throw new ValidationError("This text file is empty.");
  }
  return { text, pageCount: estimatedPages(text), pageCountIsEstimate: true };
}

export async function extractText(buffer: Buffer, extension: AcceptedExtension): Promise<ExtractionResult> {
  try {
    switch (extension) {
      case "pdf":
        return await extractPdf(buffer);
      case "docx":
        return await extractDocx(buffer);
      case "doc":
        return await extractDoc(buffer);
      case "txt":
        return extractTxt(buffer);
      default:
        throw new ValidationError("Unsupported file type.");
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error(`Document extraction failed (${extension}):`, error);
    throw new InternalError("This document couldn't be processed. Please try again.");
  }
}
