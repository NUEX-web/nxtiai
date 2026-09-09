/**
 * Hard, server-authoritative limits for the document-upload pipeline
 * (lib/server/documents/*, app/api/documents/*). These are independent of
 * plan-based quotas (lib/server/plans.ts still governs per-chunk AI cost
 * and monthly rewrite quota) -- these exist so a single upload can never
 * exhaust server memory/time regardless of plan.
 *
 * Numbers are chosen to comfortably cover the stated 30,000-word target
 * (30,000 words is ~195,000 characters at ~6.5 chars/word including
 * spaces) while staying well short of "unlimited," per the explicit
 * instruction not to advertise unlimited document size.
 */

/** Original file upload size, before any extraction happens.
 *
 * Capped by Vercel's platform-level request body limit for Functions --
 * 4.5MB, hard, on every plan (a request over that is rejected with a 413
 * before this route's code ever runs; see
 * https://vercel.com/docs/functions/limitations#request-body-size,
 * confirmed current as of this feature's implementation). 4MB leaves
 * headroom under that ceiling for multipart/form-data's own boundary and
 * field overhead. This is still generous for the stated 30,000-word
 * target: a real-world .docx/.pdf/.txt of that length runs well under
 * 500KB in testing (formatting overhead aside) -- 4MB comfortably covers
 * a 30,000+-word document even with meaningful embedded formatting. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB

/** Ceiling on *extracted* plain text length. This is the real "how big a
 * document can NXTIAI actually process" limit -- comfortably covers
 * 30,000 words (~195k chars) with room for longer documents, while still
 * being a stated, finite number rather than "unlimited." */
export const MAX_DOCUMENT_CHARS = 320_000; // ~45,000-50,000 words

/** Below this, there's nothing meaningful to process. */
export const MIN_DOCUMENT_CHARS = 20;

/** Chunk size used to split a document for processing (see
 * lib/server/documents/chunk.ts and app/api/documents/upload/route.ts).
 * Deliberately NOT the plan's maxCharsPerRequest -- that cap (as low as
 * 600 chars on the Free plan) governs a single manual /api/rewrite
 * request and produces a workable amount of output for one on-screen
 * rewrite. Reusing it here as the document chunk size was the original
 * (buggy) behavior: it made chunk count, and therefore the number of
 * sequential AI round trips runDocumentProcessing has to make (see
 * components/WritingWorkspace.tsx), scale inversely with how cheap the
 * user's plan is -- a Free-plan user processing a normal-length document
 * could need 50-100+ sequential chunks, each a full round trip, which is
 * what actually produced the "slow / hanging" upload experience. 5,000
 * chars is already proven safe for a single Gemini call in this exact
 * pipeline (it's the Pro/Team plan's own maxCharsPerRequest for manual
 * rewrites), so using it uniformly for every plan's document chunking
 * cuts round trips roughly 8x for Free-plan users with no new risk, and
 * as a side effect lets the monthly rewrite quota actually cover a
 * real document instead of exhausting after ~1,850 characters worth of
 * 600-char chunks. */
export const DOCUMENT_CHUNK_CHARS = 5000;

/** Estimate used only for formats with no native page concept (DOCX, DOC,
 * TXT). PDF page counts come from the file itself via pdf-parse and are
 * exact, not estimated -- see extract.ts. 275 words/page is the standard
 * publishing estimate (single-spaced, 12pt-equivalent). */
export const ESTIMATED_WORDS_PER_PAGE = 275;

export const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx", "txt"] as const;
export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];

/** MIME types accepted per extension. Checked alongside the extension
 * (never MIME type alone -- browsers/OSes are inconsistent about what
 * they report, and a MIME sniff alone is trivially spoofable) so a
 * mismatched or absent MIME type doesn't block a real file, while a
 * clearly wrong pairing (e.g. a .exe renamed to .pdf reporting
 * application/x-msdownload) is still caught. */
export const ACCEPTED_MIME_TYPES: Record<AcceptedExtension, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
};

export function extensionFromFilename(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return match ? match[1].toLowerCase() : "";
}

export function isAcceptedExtension(ext: string): ext is AcceptedExtension {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
}

/** Per-chunk processing attempts before a chunk (and the document as a
 * whole) is marked failed and handed back to the user as a Retry action.
 * Bounded on purpose -- see app/api/documents/[id]/process/route.ts --
 * never retried indefinitely. */
export const MAX_CHUNK_ATTEMPTS = 3;
