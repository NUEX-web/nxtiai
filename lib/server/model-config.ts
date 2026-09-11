import { AI_MODEL_OPTIONS, type AiModelId, type LanguageId, type ModeId } from "@/lib/modes";
import type { ModeConfig } from "./mode-config";
import type { VoiceProfile } from "./voice-profiles";
import { mockRewrite } from "@/lib/mock-ai";
import { UpstreamProviderError } from "./errors";
import { GeminiRewriteProvider } from "./providers/gemini-provider";
import { OpenAIRewriteProvider } from "./providers/openai-provider";

/**
 * Model selection architecture.
 *
 * AI_MODEL_OPTIONS (lib/modes.ts) is the UI-facing id/label list.
 * This file maps each id to an actual provider + model + parameters, and
 * defines the single interface every provider implementation (mock or
 * real) must satisfy. Swapping providers means writing a class that
 * implements RewriteProvider and pointing MODEL_CONFIG at it -- the route
 * handler and everything upstream of it never changes.
 */
export interface ResolvedRewriteRequest {
  text: string;
  mode: ModeId;
  modeConfig: ModeConfig;
  // string, not VoiceId: voice-profiles.ts resolves both the built-in
  // voice ids and arbitrary Supabase-backed custom voice ids (see
  // resolveVoiceProfile) -- this field isn't limited to the built-in union.
  voice: string;
  voiceProfile: VoiceProfile;
  aiModel: AiModelId;
  modelConfig: ModelConfig;
  language: LanguageId;
}

export interface RewriteProvider {
  /**
   * Streams the rewritten text as it's generated, chunk by chunk -- the
   * concatenation of every yielded string is the full result. There is
   * no separate non-streaming method: this is what lets the writer tool
   * show real text within a few hundred ms instead of making the user
   * wait out the whole generation before anything appears.
   *
   * Implementations should throw before yielding anything if the
   * request fails outright (bad key, rate limit, timeout, empty result)
   * so the route handler can still return a normal JSON error response
   * for those cases -- only once real content starts flowing does the
   * response commit to being a stream.
   */
  rewriteStream(request: ResolvedRewriteRequest): AsyncGenerator<string, void, unknown>;
}

/**
 * Development stand-in. Delegates to the existing mock rewriting logic in
 * lib/mock-ai.ts, which already simulates realistic provider latency via
 * its internal delay. Kept as the automatic fallback whenever a real
 * provider isn't configured (see getProvider below) -- never removed.
 * Chunks its output by word (with a small per-word delay) so the
 * dev/fallback experience still looks and feels like a real stream
 * instead of pasting the whole thing in at once.
 *
 * NOTE: voiceProfile and modelConfig are threaded through end-to-end (and
 * available here) but the mock transform only varies its output by
 * `mode`. Deeper per-voice/per-model variation happens in the real
 * (OpenAI) provider, where these fields become actual prompt content.
 */
export class MockRewriteProvider implements RewriteProvider {
  async *rewriteStream({ text, mode }: ResolvedRewriteRequest): AsyncGenerator<string, void, unknown> {
    let full: string;
    try {
      full = await mockRewrite(text, { mode });
    } catch (error) {
      throw new UpstreamProviderError(
        error instanceof Error ? error.message : "Mock provider failed unexpectedly."
      );
    }

    const pieces = full.split(/(\s+)/).filter(Boolean);
    for (const piece of pieces) {
      yield piece;
      if (piece.trim()) {
        await new Promise((resolve) => setTimeout(resolve, 18));
      }
    }
  }
}

/**
 * "provider" is intentionally a superset of what's wired up today.
 * anthropic exists here so the rest of the app (UI, routing) can be
 * written against the full set of providers now -- see getProvider() below,
 * which currently falls back to the mock provider for it since no
 * AnthropicRewriteProvider class exists yet. Adding one later is a change
 * to getProvider() alone.
 *
 * "gemini" is no longer the active default (see MODEL_CONFIG below) but
 * stays a fully working option -- GeminiRewriteProvider is untouched and
 * still wired up here, ready to re-enable by pointing MODEL_CONFIG back
 * at it, with no other code changes required.
 */
export type ProviderId = "mock" | "gemini" | "openai" | "anthropic";

export interface ModelConfig {
  provider: ProviderId;
  model: string;
  temperature: number;
}

// OpenAI's gpt-5.6-luna ("our fastest and most affordable model" per
// OpenAI) replaces Gemini as the default provider for every tier --
// faster responses and lower per-token cost than the previous
// gemini-3.6-flash setup, with no per-tier differentiation needed yet
// (temperature is still varied per tier, same as before).
export const MODEL_CONFIG: Record<AiModelId, ModelConfig> = {
  balanced: { provider: "openai", model: "gpt-5.6-luna", temperature: 0.5 },
  precise: { provider: "openai", model: "gpt-5.6-luna", temperature: 0.2 },
  fluent: { provider: "openai", model: "gpt-5.6-luna", temperature: 0.8 },
};

const mockProviderInstance = new MockRewriteProvider();
let geminiProviderInstance: GeminiRewriteProvider | null = null;
let openaiProviderInstance: OpenAIRewriteProvider | null = null;

/**
 * Whether a given provider has its API key present in the server
 * environment. This is the single source of truth both getProvider() (to
 * decide what actually runs) and the UI (to decide what to show as
 * available vs. "Coming soon") read from -- never duplicate this check.
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

function getGeminiProvider(): RewriteProvider {
  if (!geminiProviderInstance) {
    geminiProviderInstance = new GeminiRewriteProvider();
  }
  return geminiProviderInstance;
}

function getOpenAIProvider(): RewriteProvider {
  if (!openaiProviderInstance) {
    openaiProviderInstance = new OpenAIRewriteProvider();
  }
  return openaiProviderInstance;
}

/**
 * Returns the provider instance for a given model id. Falls back to the
 * mock provider whenever the configured provider for that id isn't
 * actually available (no API key set, or -- for anthropic today -- no
 * provider implementation exists yet) -- the app keeps working with mock
 * output rather than failing every request.
 */
export function getProvider(aiModel: AiModelId): RewriteProvider {
  const config = MODEL_CONFIG[aiModel];
  switch (config.provider) {
    case "gemini":
      return isProviderConfigured("gemini") ? getGeminiProvider() : mockProviderInstance;
    case "openai":
      return isProviderConfigured("openai") ? getOpenAIProvider() : mockProviderInstance;
    case "anthropic":
      // Provider class lands in a future phase. Routing already resolves
      // here correctly today -- only this case needs a new branch when it does.
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
 * The model name actually used to serve a request for this aiModel id --
 * as opposed to MODEL_CONFIG[aiModel].model, which is only the *target*
 * model. These differ exactly when a real provider is configured but
 * unavailable and the request silently fell back to the mock; callers
 * (the API response's X-Model header) should report this, not the
 * target, so the client is never told Gemini ran when it didn't.
 */
export function resolveActiveModelName(aiModel: AiModelId): string {
  const config = MODEL_CONFIG[aiModel];
  if (!isProviderConfigured(config.provider)) {
    return "mock-fallback";
  }
  return config.model;
}

/** Source of truth for "is this a real model id" -- used by request validation. */
export function isKnownModel(value: string): value is AiModelId {
  return Object.prototype.hasOwnProperty.call(MODEL_CONFIG, value);
}

// Fails fast in dev if lib/modes.ts and this file ever drift apart.
if (AI_MODEL_OPTIONS.some((model) => !isKnownModel(model.id))) {
  throw new Error("MODEL_CONFIG is missing an entry present in AI_MODEL_OPTIONS.");
}
