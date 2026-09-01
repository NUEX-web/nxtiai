"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  Check,
  ClipboardPaste,
  Copy,
  Loader2,
  RefreshCw,
  Repeat,
  Sparkles,
  Trash2,
} from "lucide-react";
import ModeSelector from "./ModeSelector";
import FieldSelect from "./FieldSelect";
import {
  AI_MODEL_OPTIONS,
  LANGUAGE_OPTIONS,
  VOICE_OPTIONS,
  WRITING_MODES,
  type AiModelId,
  type LanguageId,
  type ModeId,
  type VoiceId,
} from "@/lib/modes";
import { EXAMPLE_ORIGINAL } from "@/lib/mock-ai";
import { diffWords } from "@/lib/diff-words";

type Status = "idle" | "loading" | "success" | "error";

// A request past 30s is aborted server-side (see gemini-provider.ts);
// giving the client a little headroom past that means a real server
// timeout error has a chance to come back before the client gives up on
// its own.
const CLIENT_TIMEOUT_MS = 35_000;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Real, elapsed-time-based labels — not a fake progress animation. Each
 * one only appears once the request has actually been in flight that long. */
function statusLabelForElapsed(elapsedMs: number): string {
  if (elapsedMs < 3000) return "Thinking…";
  if (elapsedMs < 15000) return "Rewriting…";
  return "Almost there…";
}

interface WritingWorkspaceProps {
  /** AI model tiers whose underlying provider isn't configured server-side
   * yet — rendered as disabled "(Coming soon)" options instead of being
   * silently swapped for a working provider or allowed to error. */
  unavailableModels?: AiModelId[];
}

/** Reads ?mode=... once, for the workspace's *initial* mode only (used by
 * the nav's Product menu, e.g. /?mode=humanize#workspace — a real link
 * target, not a decoration). After mount, mode is fully owned by
 * ModeSelector — this never re-syncs from the URL, so it's a plain
 * one-time read via useSearchParams rather than a setState-in-effect. */
function useInitialMode(): ModeId {
  const searchParams = useSearchParams();
  const requested = searchParams.get("mode");
  return requested && WRITING_MODES.some((m) => m.id === requested) ? (requested as ModeId) : "standard";
}

function WritingWorkspaceInner({ unavailableModels = [] }: WritingWorkspaceProps) {
  const initialMode = useInitialMode();
  const [original, setOriginal] = useState("");
  const [result, setResult] = useState("");
  const [mode, setMode] = useState<ModeId>(initialMode);
  const [voice, setVoice] = useState<VoiceId>("my-voice");
  const [aiModel, setAiModel] = useState<AiModelId>("balanced");
  const [language, setLanguage] = useState<LanguageId>("en");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const originalWordCount = useMemo(() => countWords(original), [original]);
  const originalCharCount = original.length;
  const resultWordCount = useMemo(() => countWords(result), [result]);
  const resultCharCount = result.length;

  const diffTokens = useMemo(
    () => (compareOpen && result ? diffWords(original, result) : null),
    [compareOpen, result, original]
  );

  const runRewrite = useCallback(
    async (text: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("loading");
      setErrorMessage("");
      setElapsedMs(0);

      const startedAt = Date.now();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 400);

      const clientTimeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

      try {
        const response = await fetch("/api/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, mode, voice, aiModel, language }),
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error?.message ?? "Something went wrong. Try rewriting again.");
        }

        setResult(data.result);
        setStatus("success");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("error");
          setErrorMessage("This is taking longer than expected. The request was cancelled — please try again.");
        } else {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Try rewriting again.");
        }
      } finally {
        clearTimeout(clientTimeout);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    },
    [mode, voice, aiModel, language]
  );

  const handleRewrite = useCallback(() => {
    if (!original.trim()) {
      setStatus("error");
      setErrorMessage("Enter some text before rewriting.");
      return;
    }
    void runRewrite(original);
  }, [original, runRewrite]);

  const handleRegenerate = useCallback(() => {
    if (!original.trim()) return;
    void runRewrite(original);
  }, [original, runRewrite]);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setOriginal("");
    setResult("");
    setStatus("idle");
    setErrorMessage("");
    setCompareOpen(false);
  }, []);

  const handleTryExample = useCallback(() => {
    setOriginal(EXAMPLE_ORIGINAL);
    setStatus("idle");
    setErrorMessage("");
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setOriginal(text);
        if (status === "error") {
          setStatus("idle");
          setErrorMessage("");
        }
      }
    } catch {
      setErrorMessage("Couldn't read the clipboard — paste manually with Ctrl/Cmd+V.");
    }
  }, [status]);

  const handleReplace = useCallback(() => {
    if (!result) return;
    setOriginal(result);
    setResult("");
    setStatus("idle");
    setCompareOpen(false);
  }, [result]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setErrorMessage("Couldn't copy — select and copy the text manually.");
    }
  }, [result]);

  return (
    <>
      <div className="workspace-shell">
        {/* LEFT — settings */}
        <div className="workspace-settings panel flex flex-col gap-5 p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Mode</p>
            <ModeSelector value={mode} onChange={setMode} />
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Settings</p>
            <FieldSelect
              id="voice-select"
              label="Voice"
              value={voice}
              options={VOICE_OPTIONS}
              onChange={(value) => setVoice(value as VoiceId)}
            />
            <FieldSelect
              id="ai-model-select"
              label="AI model"
              value={aiModel}
              options={AI_MODEL_OPTIONS}
              onChange={(value) => setAiModel(value as AiModelId)}
              disabledIds={unavailableModels}
            />
            <FieldSelect
              id="language-select"
              label="Language"
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={(value) => setLanguage(value as LanguageId)}
            />
          </div>
        </div>

        {/* CENTER — input editor */}
        <div className="workspace-editor panel flex flex-col p-4 md:p-5">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="original-text" className="text-sm font-medium text-ink">
              Original
            </label>
            <span className="text-xs text-ink-faint">
              {originalWordCount} words · {originalCharCount} characters
            </span>
          </div>

          <textarea
            id="original-text"
            value={original}
            onChange={(event) => {
              setOriginal(event.target.value);
              if (status === "error" && event.target.value.trim()) {
                setStatus("idle");
                setErrorMessage("");
              }
            }}
            placeholder="Paste or write your text here…"
            rows={12}
            className="min-h-64 w-full flex-1 resize-none rounded-xl border border-line bg-canvas p-4 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus-visible:border-accent"
          />

          {status === "error" && errorMessage && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {errorMessage}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePaste}
              className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
            >
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
              Paste
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!original && !result}
              className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>

            <button
              type="button"
              onClick={handleRewrite}
              disabled={status === "loading"}
              className="ml-auto flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {status === "loading" ? statusLabelForElapsed(elapsedMs) : "Rewrite"}
            </button>
          </div>
        </div>

        {/* RIGHT — output */}
        <div className="workspace-output panel flex flex-col p-4 md:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Result</span>
            {result && status !== "loading" && (
              <span className="text-xs text-ink-faint">
                {resultWordCount} words · {resultCharCount} characters
              </span>
            )}
          </div>

          <div className="relative min-h-64 flex-1 rounded-xl border border-accent-soft-line bg-accent-soft p-4">
            {status === "loading" ? (
              <div className="flex h-full flex-col justify-center gap-3" aria-live="polite">
                <span className="sr-only">{statusLabelForElapsed(elapsedMs)}</span>
                <p className="text-sm font-medium text-accent-strong">{statusLabelForElapsed(elapsedMs)}</p>
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-accent-soft-line">
                  <div className="absolute inset-y-0 w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
                </div>
                <div className="h-3 w-11/12 animate-pulse rounded bg-accent-soft-line" />
                <div className="h-3 w-full animate-pulse rounded bg-accent-soft-line" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-accent-soft-line" />
              </div>
            ) : result ? (
              <>
                {compareOpen && diffTokens ? (
                  <p className="reveal-line whitespace-pre-wrap pr-4 text-[15px] leading-relaxed text-ink">
                    {diffTokens.map((token, index) =>
                      token.type === "same" ? (
                        <span key={index}>{token.text}</span>
                      ) : token.type === "add" ? (
                        <span key={index} className="rounded bg-success-soft text-success">
                          {token.text}
                        </span>
                      ) : (
                        <span key={index} className="rounded bg-danger-soft text-danger line-through">
                          {token.text}
                        </span>
                      )
                    )}
                  </p>
                ) : (
                  <p className="reveal-line whitespace-pre-wrap pr-4 text-[15px] leading-relaxed text-ink">
                    {result}
                  </p>
                )}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="max-w-xs text-sm text-ink-soft">
                  Your rewritten text will appear here once you click Rewrite.
                </p>
                <button
                  type="button"
                  onClick={handleTryExample}
                  className="text-sm font-medium text-accent-strong underline decoration-accent-soft-line underline-offset-4 hover:decoration-accent-strong"
                >
                  Try an example
                </button>
              </div>
            )}
          </div>

          {result && status !== "loading" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleReplace}
                className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
              >
                <Repeat className="h-3.5 w-3.5" />
                Replace original
              </button>
              <button
                type="button"
                onClick={() => setCompareOpen((open) => !open)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                  compareOpen
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
                }`}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Compare
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-faint">Rewrites are generated using Google Gemini.</p>
    </>
  );
}

/** Static shape shown only for the brief moment Next.js needs to resolve
 * useSearchParams() inside the Suspense boundary below — same panel
 * proportions as the real workspace so nothing jumps once it swaps in. */
function WorkspaceFallback() {
  return (
    <div className="workspace-shell" aria-hidden="true">
      <div className="workspace-settings panel h-64 animate-pulse p-4" />
      <div className="workspace-editor panel h-96 animate-pulse p-4" />
      <div className="workspace-output panel h-96 animate-pulse p-4" />
    </div>
  );
}

export default function WritingWorkspace(props: WritingWorkspaceProps) {
  return (
    <section id="workspace" className="mx-auto max-w-6xl px-6 py-10 md:py-14">
      <Suspense fallback={<WorkspaceFallback />}>
        <WritingWorkspaceInner {...props} />
      </Suspense>
    </section>
  );
}
