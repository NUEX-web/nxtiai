import { LANGUAGE_OPTIONS } from "@/lib/modes";
import { isKnownMode } from "@/lib/server/mode-config";
import { isKnownVoice } from "@/lib/server/voice-profiles";
import { isKnownModel } from "@/lib/server/model-config";
import { ValidationError } from "@/lib/server/errors";
import type { AiModelId, LanguageId, ModeId } from "@/lib/modes";

const LANGUAGE_IDS = LANGUAGE_OPTIONS.map((option) => option.id);

/**
 * Validates the rewrite-settings fields sent alongside a document upload
 * (multipart form fields, not JSON -- see app/api/documents/upload) against
 * the exact same server-side config modules /api/rewrite validates
 * against, so an unknown or forged id is rejected the same way in both
 * places. Kept separate from lib/server/validation.ts's zod schema
 * because that schema also validates `text` against the single-request
 * 5,000-character cap, which doesn't apply to a whole document.
 */
export interface DocumentRewriteSettings {
  mode: ModeId;
  voice: string;
  aiModel: AiModelId;
  language: LanguageId;
}

export function parseDocumentRewriteSettings(fields: {
  mode: FormDataEntryValue | null;
  voice: FormDataEntryValue | null;
  aiModel: FormDataEntryValue | null;
  language: FormDataEntryValue | null;
}): DocumentRewriteSettings {
  const mode = typeof fields.mode === "string" ? fields.mode : "";
  const voice = typeof fields.voice === "string" ? fields.voice : "";
  const aiModel = typeof fields.aiModel === "string" ? fields.aiModel : "";
  const language = typeof fields.language === "string" ? fields.language : "";

  if (!isKnownMode(mode)) throw new ValidationError("Unknown writing mode.");
  if (!isKnownVoice(voice)) throw new ValidationError("Unknown voice.");
  if (!isKnownModel(aiModel)) throw new ValidationError("Unknown AI model.");
  if (!LANGUAGE_IDS.includes(language as (typeof LANGUAGE_IDS)[number])) {
    throw new ValidationError("Unknown language.");
  }

  return { mode: mode as ModeId, voice, aiModel: aiModel as AiModelId, language: language as LanguageId };
}
