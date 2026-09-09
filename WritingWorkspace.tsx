"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
import AddProjectMenu from "./AddProjectMenu";
import DocumentCard, { type DocumentUploadStatus } from "./DocumentCard";
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

type Status = "idle" | "loading" | "streaming" | "success" | "error";

interface DocumentState {
  id: string;
  filename: string;
  originalText: string;
  wordCount: number;
  charCount: number;
  pageCount: number;
  pageCountIsEstimate: boolean;
  chunkCount: number;
  chunksCompleted: number;
  currentChunkIndex: number | null;
  status: DocumentUploadStatus;
  errorMessage: string | null;
}

/** Real, elapsed-time-based labels for the single upload+extract request
 * (see runRewrite's statusLabelForElapsed above -- same "never a fake
 * progress animation" philosophy). Once processing starts, progress
 * labels switch to server-reported chunk counts, which are fully real. */
function uploadStatusLabel(elapsedMs: number): string {
  if (elapsedMs < 1200) return "Uploading…";
  if (elapsedMs < 3500) return "Reading document…";
  return "Preparing document…";
}

function processingStatusLabel(chunksCompleted: number, chunkCount: number, currentChunkIndex: number | null): string {
  if (chunkCount <= 1) return "Processing document…";
  if (currentChunkIndex && currentChunkIndex > chunkCount) return "Finalizing document…";
  const section = currentChunkIndex ?? Math.min(chunksCompleted + 1, chunkCount);
  return `Processing section ${section} of ${chunkCount}…`;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.error?.message ?? fallback;
}

// Must match the server's STREAM_ERROR_MARKER in app/api/rewrite/route.ts
// exactly -- it can't be imported directly since that file is server-only.
// Written into the stream only when generation fails partway through, so
// a partial result is never silently shown as if it were the full one.
const STREAM_ERROR_MARKER = "\u0000NXTIAI_STREAM_ERROR\u0000";

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

/** Label for the Rewrite button/live region once real text is arriving --
 * distinct from the pre-first-token "Thinking…" progression above. */
function statusLabelForStatus(status: Status, elapsedMs: number): string {
  return status === "streaming" ? "Writing…" : statusLabelForElapsed(elapsedMs);
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
  const [warningMessage, setWarningMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [docState, setDocState] = useState<DocumentState | null>(null);
  const [docUploadElapsedMs, setDocUploadElapsedMs] = useState(0);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const docTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards the processing loop against a stale run continuing after the
  // document was removed/replaced -- incremented on every new upload or
  // removal, and checked before each step so an in-flight loop for a
  // document the user just removed stops on its next tick instead of
  // clobbering state for whatever replaced it.
  const docGenerationRef = useRef(0);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      if (docTimerRef.current) clearInterval(docTimerRef.current);
    };
  }, []);

  const originalWordCount = useMemo(() => countWords(original), [original]);
  const originalCharCount = original.length;
  const resultWordCount = useMemo(() => countWords(result), [result]);
  const resultCharCount = result.length;

  const diffTokens = useMemo(
    () => (compareOpen && status === "success" && result ? diffWords(original, result) : null),
    [compareOpen, status, result, original]
  );

  const runRewrite = useCallback(
    async (text: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("loading");
      setErrorMessage("");
      setWarningMessage("");
      setResult("");
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

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error?.message ?? "Something went wrong. Try rewriting again.");
        }

        if (!response.body) {
          // No streaming support in this environment -- fall back to
          // reading the whole response at once rather than failing.
          const whole = await response.text();
          setResult(whole.trim());
          setStatus("success");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sawFirstChunk = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          if (!sawFirstChunk) {
            sawFirstChunk = true;
            setStatus("streaming");
          }
          setResult(buffer);
        }
        buffer += decoder.decode();

        const markerIndex = buffer.indexOf(STREAM_ERROR_MARKER);
        if (markerIndex !== -1) {
          setResult(buffer.slice(0, markerIndex).trim());
          setWarningMessage(
            "Connection interrupted partway through — showing a partial result. Click Regenerate for the full rewrite."
          );
        } else {
          setResult(buffer.trim());
        }

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
    // An attached document is rewritten automatically through its own
    // chunked pipeline (see beginDocumentUpload/runDocumentProcessing) --
    // the single-shot /api/rewrite endpoint has a much lower character
    // cap and isn't meant for whole-document input.
    if (docState) return;
    if (!original.trim()) {
      setStatus("error");
      setErrorMessage("Enter some text before rewriting.");
      return;
    }
    void runRewrite(original);
  }, [original, runRewrite, docState]);

  const handleRegenerate = useCallback(() => {
    if (docState) return;
    if (!original.trim()) return;
    void runRewrite(original);
  }, [original, runRewrite, docState]);

  /** Detaches the current document from the workspace: stops any
   * in-flight processing loop for it (via docGenerationRef) and, unless
   * told not to, removes its row server-side too. Fire-and-forget on the
   * delete -- the workspace shouldn't block on cleanup of a document the
   * user is actively walking away from. */
  const detachDocument = useCallback((deleteRemote: boolean) => {
    docGenerationRef.current += 1;
    if (docTimerRef.current) {
      clearInterval(docTimerRef.current);
      docTimerRef.current = null;
    }
    setDocState((current) => {
      if (deleteRemote && current?.id) {
        fetch(`/api/documents/${current.id}`, { method: "DELETE" }).catch(() => {});
      }
      return null;
    });
  }, []);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    detachDocument(true);
    setOriginal("");
    setResult("");
    setStatus("idle");
    setErrorMessage("");
    setWarningMessage("");
    setCompareOpen(false);
  }, [detachDocument]);

  const handleTryExample = useCallback(() => {
    detachDocument(true);
    setOriginal(EXAMPLE_ORIGINAL);
    setStatus("idle");
    setErrorMessage("");
    setWarningMessage("");
  }, [detachDocument]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        detachDocument(true);
        setOriginal(text);
        if (status === "error") {
          setStatus("idle");
          setErrorMessage("");
        }
      }
    } catch {
      setErrorMessage("Couldn't read the clipboard — paste manually with Ctrl/Cmd+V.");
    }
  }, [status, detachDocument]);

  /** Drives one document's chunked processing to completion, one
   * server-side chunk per request (see app/api/documents/[id]/process) --
   * this loop is what produces the real, server-reported "Processing
   * section X of N…" progress, and what a Retry click re-enters after a
   * failure. `generation` pins this run to the document it started for;
   * if the user removes or replaces the document mid-loop,
   * docGenerationRef has moved on and this loop quietly stops instead of
   * overwriting the new state. */
  const runDocumentProcessing = useCallback(async (documentId: string, generation: number) => {
    while (docGenerationRef.current === generation) {
      let response: Response;
      try {
        response = await fetch(`/api/documents/${documentId}/process`, { method: "POST" });
      } catch {
        if (docGenerationRef.current !== generation) return;
        setDocState((current) =>
          current ? { ...current, status: "failed", errorMessage: "Network error. Check your connection and retry." } : current
        );
        return;
      }

      if (docGenerationRef.current !== generation) return;

      if (!response.ok) {
        const message = await readErrorMessage(response, "Something went wrong processing this document.");
        setDocState((current) => (current ? { ...current, status: "failed", errorMessage: message } : current));
        return;
      }

      const data = await response.json();
      if (docGenerationRef.current !== generation) return;

      setDocState((current) =>
        current
          ? {
              ...current,
              status: data.status,
              chunksCompleted: data.chunksCompleted,
              currentChunkIndex: data.currentChunkIndex,
              errorMessage: data.errorMessage,
            }
          : current
      );

      if (data.status === "ready") {
        setResult((data.resultText ?? "").trim());
        setStatus("success");
        setWarningMessage("");
        return;
      }
      if (data.status === "failed") {
        return;
      }

      // Still processing -- brief pause before advancing to the next
      // chunk, both to keep each progress step visible and to avoid
      // hammering the API in a pathological fast-fail loop.
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }, []);

  const beginDocumentUpload = useCallback(
    async (file: File) => {
      docGenerationRef.current += 1;
      const generation = docGenerationRef.current;

      abortRef.current?.abort();
      setStatus("idle");
      setErrorMessage("");
      setWarningMessage("");
      setCompareOpen(false);
      setResult("");
      setDocUploadElapsedMs(0);

      const startedAt = Date.now();
      if (docTimerRef.current) clearInterval(docTimerRef.current);
      docTimerRef.current = setInterval(() => setDocUploadElapsedMs(Date.now() - startedAt), 300);

      setDocState({
        id: "",
        filename: file.name,
        originalText: "",
        wordCount: 0,
        charCount: 0,
        pageCount: 0,
        pageCountIsEstimate: true,
        chunkCount: 0,
        chunksCompleted: 0,
        currentChunkIndex: null,
        status: "uploading",
        errorMessage: null,
      });

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mode", mode);
        formData.append("voice", voice);
        formData.append("aiModel", aiModel);
        formData.append("language", language);

        const response = await fetch("/api/documents/upload", { method: "POST", body: formData });

        if (docGenerationRef.current !== generation) return;

        if (!response.ok) {
          const message = await readErrorMessage(response, "Couldn't upload this document.");
          if (docTimerRef.current) {
            clearInterval(docTimerRef.current);
            docTimerRef.current = null;
          }
          setDocState(null);
          setStatus("error");
          setErrorMessage(message);
          return;
        }

        const data = await response.json();
        if (docGenerationRef.current !== generation) return;

        if (docTimerRef.current) {
          clearInterval(docTimerRef.current);
          docTimerRef.current = null;
        }

        setOriginal(data.originalText);
        setDocState({
          id: data.id,
          filename: data.filename,
          originalText: data.originalText,
          wordCount: data.wordCount,
          charCount: data.charCount,
          pageCount: data.pageCount,
          pageCountIsEstimate: data.pageCountIsEstimate,
          chunkCount: data.chunkCount,
          chunksCompleted: 0,
          currentChunkIndex: 1,
          status: "processing",
          errorMessage: null,
        });

        void runDocumentProcessing(data.id, generation);
      } catch {
        if (docGenerationRef.current !== generation) return;
        if (docTimerRef.current) {
          clearInterval(docTimerRef.current);
          docTimerRef.current = null;
        }
        setDocState(null);
        setStatus("error");
        setErrorMessage("Couldn't upload this document. Check your connection and try again.");
      }
    },
    [mode, voice, aiModel, language, runDocumentProcessing]
  );

  const handleRemoveDocument = useCallback(() => {
    detachDocument(true);
    setOriginal("");
    setResult("");
    setStatus("idle");
    setWarningMessage("");
    setCompareOpen(false);
  }, [detachDocument]);

  const handleReplaceDocumentClick = useCallback(() => {
    replaceInputRef.current?.click();
  }, []);

  const handleReplaceFileChosen = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void beginDocumentUpload(file);
    },
    [beginDocumentUpload]
  );

  const handleRetryDocument = useCallback(() => {
    if (!docState) return;
    const generation = docGenerationRef.current;
    setDocState((current) => (current ? { ...current, status: "processing", errorMessage: null } : current));
    void runDocumentProcessing(docState.id, generation);
  }, [docState, runDocumentProcessing]);

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

          {docState && (
            <DocumentCard
              filename={docState.filename}
              wordCount={docState.wordCount}
              pageCount={docState.pageCount}
              pageCountIsEstimate={docState.pageCountIsEstimate}
              status={docState.status}
              progressLabel={
                docState.status === "uploading"
                  ? uploadStatusLabel(docUploadElapsedMs)
                  : docState.status === "ready"
                    ? "Ready ✓"
                    : processingStatusLabel(docState.chunksCompleted, docState.chunkCount, docState.currentChunkIndex)
              }
              errorMessage={docState.errorMessage}
              originalText={docState.originalText}
              onRemove={handleRemoveDocument}
              onReplace={handleReplaceDocumentClick}
              onRetry={handleRetryDocument}
            />
          )}

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
          {status === "success" && warningMessage && (
            <p role="status" className="mt-2 text-sm text-amber-600">
              {warningMessage}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <AddProjectMenu
              onFileSelected={(file) => void beginDocumentUpload(file)}
              disabled={status === "loading" || status === "streaming" || docState?.status === "uploading" || docState?.status === "processing"}
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleReplaceFileChosen}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
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
              disabled={!original && !result && !docState}
              className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>

            <button
              type="button"
              onClick={handleRewrite}
              disabled={status === "loading" || status === "streaming" || Boolean(docState)}
              title={docState ? "This document is rewritten automatically once uploaded." : undefined}
              className="ml-auto flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === "loading" || status === "streaming" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {status === "loading" || status === "streaming" ? statusLabelForStatus(status, elapsedMs) : "Rewrite"}
            </button>
          </div>
        </div>

        {/* RIGHT — output */}
        <div className="workspace-output panel flex flex-col p-4 md:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Result</span>
            {result && status === "success" && (
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
                  <p className="whitespace-pre-wrap pr-4 text-[15px] leading-relaxed text-ink" aria-live={status === "streaming" ? "polite" : undefined}>
                    {result}
                    {status === "streaming" && (
                      <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-accent align-text-bottom" aria-hidden="true" />
                    )}
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

          {result && status === "success" && (
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
                disabled={Boolean(docState)}
                title={docState ? "Use Retry on the document card to reprocess a failed section." : undefined}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-faint">Rewrites are generated using NXTIAI&apos;s AI engine.</p>
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
