/**
 * Minimal ambient types for the one `mammoth` entry point NXTIAI's
 * document-upload pipeline actually uses (lib/server/documents/extract.ts).
 *
 * mammoth ships no bundled `.d.ts` and no `@types/mammoth` package exists
 * on npm (confirmed: `npm view @types/mammoth` returns 404) -- so this is
 * a small, hand-written declaration scoped to the real call shape, rather
 * than suppressing type-checking for the import.
 */
declare module "mammoth" {
  export interface MammothMessage {
    type: string;
    message: string;
  }

  export interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  export interface MammothInput {
    buffer: Buffer;
  }

  export function extractRawText(input: MammothInput): Promise<MammothResult>;
  export function convertToHtml(input: MammothInput): Promise<MammothResult>;
}
