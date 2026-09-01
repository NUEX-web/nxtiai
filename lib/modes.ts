export type ModeId =
  | "standard"
  | "academic"
  | "professional"
  | "creative"
  | "simple"
  | "expand"
  | "shorten"
  | "humanize"
  | "legal-simplifier"
  | "email";

export interface WritingMode {
  id: ModeId;
  label: string;
  description: string;
}

export const WRITING_MODES: WritingMode[] = [
  { id: "standard", label: "Standard", description: "Clear, natural rewriting" },
  { id: "academic", label: "Academic", description: "Formal, precise, citation-ready" },
  { id: "professional", label: "Professional", description: "Polished for work and clients" },
  { id: "creative", label: "Creative", description: "Expressive and vivid phrasing" },
  { id: "simple", label: "Simple", description: "Plain language, shorter sentences" },
  { id: "expand", label: "Expand", description: "Add detail and supporting context" },
  { id: "shorten", label: "Shorten", description: "Trim to the essential point" },
  { id: "humanize", label: "Humanize", description: "Sound less like a machine wrote it" },
  { id: "legal-simplifier", label: "Legal Simplifier", description: "Plain-English contract language" },
  { id: "email", label: "Email", description: "Structured for a real inbox" },
];

export type VoiceId = "my-voice" | "professional" | "academic" | "casual" | "business";

export interface VoiceOption {
  id: VoiceId;
  label: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "my-voice", label: "My Voice" },
  { id: "professional", label: "Professional" },
  { id: "academic", label: "Academic" },
  { id: "casual", label: "Casual" },
  { id: "business", label: "Business" },
];

export type AiModelId = "balanced" | "precise" | "fluent";

export interface AiModelOption {
  id: AiModelId;
  label: string;
}

export const AI_MODEL_OPTIONS: AiModelOption[] = [
  { id: "balanced", label: "Balanced" },
  { id: "precise", label: "Precise" },
  { id: "fluent", label: "Fluent" },
];

export type LanguageId = "en" | "nl" | "de" | "fr";

export interface LanguageOption {
  id: LanguageId;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: "en", label: "English" },
  { id: "nl", label: "Dutch" },
  { id: "de", label: "German" },
  { id: "fr", label: "French" },
];
