import { VOICE_OPTIONS } from "@/lib/modes";

export interface VoiceProfile {
  id: string;
  label: string;
  tone: string;
  vocabularyLevel: "simple" | "standard" | "advanced";
  formality: "low" | "neutral" | "high";
  customInstructions?: string;
}

const VOICE_PROFILES: Record<string, VoiceProfile> = {
  "my-voice": {
    id: "my-voice",
    label: "My Voice",
    tone: "neutral, close to the user's own default phrasing",
    vocabularyLevel: "standard",
    formality: "neutral",
  },
  professional: {
    id: "professional",
    label: "Professional",
    tone: "polished and workplace-appropriate",
    vocabularyLevel: "standard",
    formality: "high",
  },
  academic: {
    id: "academic",
    label: "Academic",
    tone: "formal and precise",
    vocabularyLevel: "advanced",
    formality: "high",
  },
  casual: {
    id: "casual",
    label: "Casual",
    tone: "relaxed and conversational",
    vocabularyLevel: "simple",
    formality: "low",
  },
  business: {
    id: "business",
    label: "Business",
    tone: "direct and results-oriented",
    vocabularyLevel: "standard",
    formality: "high",
  },
};

/** Source of truth for "is this a real voice id" — allows built-in or custom string IDs. */
export function isKnownVoice(value: string): boolean {
  if (Object.prototype.hasOwnProperty.call(VOICE_PROFILES, value)) {
    return true;
  }
  // Allow non-empty string IDs (such as custom UUIDs created by users)
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveVoiceProfile(id: string, customVoiceRecord?: Partial<VoiceProfile>): VoiceProfile {
  if (VOICE_PROFILES[id]) {
    return VOICE_PROFILES[id];
  }

  if (customVoiceRecord) {
    return {
      id,
      label: customVoiceRecord.label || customVoiceRecord.id || "Custom Voice",
      tone: customVoiceRecord.tone || "neutral",
      vocabularyLevel: customVoiceRecord.vocabularyLevel || "standard",
      formality: customVoiceRecord.formality || "neutral",
      customInstructions: customVoiceRecord.customInstructions,
    };
  }

  // Fallback to neutral profile
  return VOICE_PROFILES["my-voice"];
}

// Fails fast in dev if lib/modes.ts and this file ever drift apart.
if (VOICE_OPTIONS.some((voice) => !isKnownVoice(voice.id))) {
  throw new Error("VOICE_PROFILES is missing an entry present in VOICE_OPTIONS.");
}

