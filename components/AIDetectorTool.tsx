"use client";

import { useCallback, useState } from "react";
import { Loader2, ScanSearch, X } from "lucide-react";

interface DetectionResult {
  aiLikelihoodPercent: number;
  verdict: "Likely human-written" | "Mixed / uncertain" | "Likely AI-generated";
  explanation: string;
}

type Status = "idle" | "loading" | "success" | "error";

interface AIDetectorToolProps {
  /** Prefills the textarea -- e.g. the workspace editor's current text or
   * an uploaded document's extracted text, passed in by whatever opened
   * this tool. Purely a starting value; the user can still edit or clear
   * it before checking, same as the standalone /ai-detector page. */
  initialText?: string;
  /** Renders without the standalone page's heading size/vertical padding
   * for use inside a modal (see WritingWorkspace's AI Detector button).
   * The detection logic and result rendering are identical either way --
   * this only changes layout chrome. */
  embedded?: boolean;
  /** Only used when embedded -- shows a close button in the modal header. */
  onClose?: () => void;
}

function verdictColor(verdict: DetectionResult["verdict"]): string {
  if (verdict === "Likely AI-generated") return "text-danger";
  if (verdict === "Mixed / uncertain") return "text-amber-600";
  return "text-emerald-600";
}

export default function AIDetectorTool({ initialText = "", embedded = false, onClose }: AIDetectorToolProps) {
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleCheck = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMessage("");

    void (async () => {
      try {
        const response = await fetch("/api/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });

        const data: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            data && typeof data === "object" && "error" in data
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ((data as any).error?.message as string | undefined)
              : undefined;
          throw new Error(message || "Something went wrong. Please try again.");
        }

        setResult(data as DetectionResult);
        setStatus("success");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
        setStatus("error");
      }
    })();
  }, [text]);

  return (
    <div className={embedded ? "flex flex-col" : "mx-auto max-w-2xl px-6 py-20"}>
      {embedded ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">AI Detector</h2>
            <p className="mt-2 text-sm text-ink-soft">
              An estimate of how likely this text is AI-generated — not a verdict. Results can be
              wrong in either direction.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI Detector"
              className="shrink-0 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-accent-soft hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      ) : (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-ink">AI Detector</h1>
          <p className="mt-3 text-ink-soft">
            Paste text below to get an estimate of how likely it is to be AI-generated. This is a
            genuine estimate, not a verdict — no detector, from any vendor, can verify authorship
            with full confidence, and results can be wrong in both directions.
          </p>
        </>
      )}

      <div className={embedded ? "panel mt-4 flex flex-col p-4 md:p-5" : "panel mt-8 flex flex-col p-4 md:p-5"}>
        <label htmlFor="detector-text" className="text-sm font-medium text-ink">
          Text to check
        </label>
        <textarea
          id="detector-text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="Paste text here…"
          rows={10}
          className="mt-2 min-h-56 w-full resize-none rounded-xl border border-line bg-canvas p-4 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus-visible:border-accent"
        />

        {status === "error" && errorMessage && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handleCheck}
          disabled={status === "loading" || !text.trim()}
          className="mt-4 flex items-center justify-center gap-2 self-start rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ScanSearch className="h-4 w-4" aria-hidden="true" />
          )}
          {status === "loading" ? "Checking…" : "Check text"}
        </button>
      </div>

      {status === "success" && result && (
        <div className="panel mt-6 p-4 md:p-5">
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-medium ${verdictColor(result.verdict)}`}>
              {result.aiLikelihoodPercent}% likely AI-generated
            </span>
          </div>
          <p className={`mt-1 text-sm font-medium ${verdictColor(result.verdict)}`}>{result.verdict}</p>
          <p className="mt-3 text-sm text-ink-soft">{result.explanation}</p>
          <p className="mt-4 text-xs text-ink-faint">Estimate only — not a definitive result.</p>
        </div>
      )}
    </div>
  );
}
