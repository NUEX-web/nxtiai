import { AI_MODEL_OPTIONS, type AiModelId, type LanguageId, type ModeId } from "@/lib/modes";
import type { ModeConfig } from "./mode-config";
import type { VoiceProfile } from "./voice-profiles";
import { mockRewrite } from "@/lib/mock-ai";
import { UpstreamProviderError } from "./errors";
import { GeminiRewriteProvider } from "./providers/gemini-provider";

/**
 * Model selection architecture.
 *
 * AI_MODEL_OPTIONS (lib/modes.ts) is the UI-facing id/label list.
 * This file maps each id to an actual provider + model + parameters, and
 * defines the single interface every provider implementation (mock or
 * real) must satisfy. Swapping providers means writing a class that
 * implements RewriteProvider and pointing MODEL_CONFIG at it — the route
 * handler and everything upstream of it never changes.
 */
export interface ResolvedRewriteRequest {
  text: string;
  mode: ModeId;
  modeConfig: ModeConfig;
  // string, not VoiceId: voice-profiles.ts resolves both the built-in
  // voice ids and arbitrary Supabase-backed custom voice ids (see
  // resolveVoiceProfile) — this field isn't limited to the built-in union.
  voice: string;
  voiceProfile: VoiceProfile;
  aiModel: AiModelId;
  modelConfig: ModelConfig;
  language: LanguageId;
}

export interface ProviderResult {
  result: string;
}

export interface RewriteProvider {
  rewrite(request: ResolvedRewriteRequest): Promise<ProviderResult>;
}

/**
 * Development stand-in. Delegates to the existing mock rewriting logic in
 * lib/mock-ai.ts, which already simulates realistic provider latency via
 * its internal delay. Kept as the automatic fallback whenever a real
 * provider isn't configured (see getProvider below) — never removed.
 *
 * NOTE: voiceProfile and modelConfig are threaded through end-to-end (and
 * available here) but the mock transform only varies its output by
 * `mode`. Deeper per-voice/per-model variation happens in the real
 * (Gemini) provider, where these fields become actual prompt content.
 */
export class MockRewriteProvider implements RewriteProvider {
  async rewrite({ text, mode }: ResolvedRewriteRequest): Promise<ProviderResult> {
    try {
      const result = await mockRewrite(text, { mode });
      return { result };
    } catch (error) {
      throw new UpstreamProviderError(
        error instanceof Error ? error.message : "Mock provider failed unexpectedly."
      );
    }
  }
}

/**
 * "provider" is intentionally a superset of what's wired up today.
 * openai/anthropic exist here so the rest of the app (UI, routing) can be
 * written against the full set of providers now — see getProvider() below,
 * which currently falls back to the mock provider for both since no
 * OpenAIRewriteProvider/AnthropicRewriteProvider class exists yet. Adding
 * one later is a change to getProvider() alone.
 */
export type ProviderId = "mock" | "gemini" | "openai" | "anthropic";

export interface ModelConfig {
  provider: ProviderId;
  model: string;
  temperature: number;
}

export const MODEL_CONFIG: Record<AiModelId, ModelConfig> = {
  balanced: { provider: "gemini", model: "gemini-3.6-flash", temperature: 0.5 },
  precise: { provider: "gemini", model: "gemini-3.6-flash", temperature: 0.2 },
  fluent: { provider: "gemini", model: "gemini-3.6-flash", temperature: 0.8 },
};

const mockProviderInstance = new MockRewriteProvider();
let geminiProviderInstance: GeminiRewriteProvider | null = null;

/**
 * Whether a given provider has its API key present in the server
 * environment. This is the single source of truth both getProvider() (to
 * decide what actually runs) and the UI (to decide what to show as
 * available vs. "Coming soon") read from — never duplicate this check.
 */
export function isProviderConfigured(provider: ProviderId): boolean {
  switch (provider) {
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY);
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "mock":
      return true;
  }
}

/** @deprecated use isProviderConfigured("gemini") */
function isGeminiConfigured(): boolean {
  return isProviderConfigured("gemini");
}

function getGeminiProvider(): RewriteProvider {
  if (!geminiProviderInstance) {
    geminiProviderInstance = new GeminiRewriteProvider();
  }
  return geminiProviderInstance;
}

/**
 * Returns the provider instance for a given model id. Falls back to the
 * mock provider whenever the configured provider for that id isn't
 * actually available (no API key set, or — for openai/anthropic today —
 * no provider implementation exists yet) — the app keeps working with
 * mock output rather than failing every request.
 */
export function getProvider(aiModel: AiModelId): RewriteProvider {
  const config = MODEL_CONFIG[aiModel];
  switch (config.provider) {
    case "gemini":
      return isGeminiConfigured() ? getGeminiProvider() : mockProviderInstance;
    case "openai":
    case "anthropic":
      // Provider classes land in Phase 2. Routing already resolves here
      // correctly today — only this case needs a new branch when they do.
      return mockProviderInstance;
    case "mock":
    default:
      return mockProviderInstance;
  }
}

/**
 * Per-tier availability for the UI's AI model selector: whether the
 * provider a tier maps to is actually configured right now. Lets the UI
 * show "Coming soon" instead of a selectable-but-broken option, without
 * hardcoding which providers are live outside this one config file.
 */
export function getModelAvailability(aiModel: AiModelId): boolean {
  return isProviderConfigured(MODEL_CONFIG[aiModel].provider);
}

/**
 * The model name actually used to serve a request for this aiModel id —
 * as opposed to MODEL_CONFIG[aiModel].model, which is only the *target*
 * model. These differ exactly when a real provider is configured but
 * unavailable and the request silently fell back to the mock; callers
 * (the API response's meta.model field) should report this, not the
 * target, so the client is never told Gemini ran when it didn't.
 */
export function resolveActiveModelName(aiModel: AiModelId): string {
  const config = MODEL_CONFIG[aiModel];
  if (config.provider === "gemini" && !isGeminiConfigured()) {
    return "mock-fallback";
  }
  return config.model;
}

/** Source of truth for "is this a real model id" — used by request validation. */
export function isKnownModel(value: string): value is AiModelId {
  return Object.prototype.hasOwnProperty.call(MODEL_CONFIG, value);
}

// Fails fast in dev if lib/modes.ts and this file ever drift apart.
if (AI_MODEL_OPTIONS.some((model) => !isKnownModel(model.id))) {
  throw new Error("MODEL_CONFIG is missing an entry present in AI_MODEL_OPTIONS.");
}
