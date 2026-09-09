"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Eye, FileText, Loader2, RefreshCw, X } from "lucide-react";

export type DocumentUploadStatus = "uploading" | "processing" | "ready" | "failed";

interface DocumentCardProps {
  filename: string;
  wordCount: number;
  pageCount: number;
  pageCountIsEstimate: boolean;
  status: DocumentUploadStatus;
  progressLabel: string;
  errorMessage?: string | null;
  originalText: string;
  onRemove: () => void;
  onReplace: () => void;
  onRetry: () => void;
}

/** Document card shown above the editor once a file has been added --
 * uses the same indigo AI/file accent as AddProjectMenu so an active
 * upload reads as one visual unit with the button that started it. */
export default function DocumentCard({
  filename,
  wordCount,
  pageCount,
  pageCountIsEstimate,
  status,
  progressLabel,
  errorMessage,
  originalText,
  onRemove,
  onReplace,
  onRetry,
}: DocumentCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const busy = status === "uploading" || status === "processing";

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-ai-accent-soft-line bg-ai-accent-soft">
      <div className="flex items-start gap-3 p-3.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-ai-accent-strong">
          {status === "failed" ? (
            <CircleAlert className="h-4 w-4 text-danger" aria-hidden="true" />
          ) : status === "ready" ? (
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{filename}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {wordCount.toLocaleString()} words · {pageCountIsEstimate ? "~" : ""}
            {pageCount.toLocaleString()} {pageCount === 1 ? "page" : "pages"}
          </p>

          <div className="mt-1.5 flex items-center gap-1.5" aria-live="polite">
            {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ai-accent-strong" aria-hidden="true" />}
            <p
              className={`text-xs font-medium ${
                status === "failed" ? "text-danger" : status === "ready" ? "text-success" : "text-ai-accent-strong"
              }`}
            >
              {status === "failed" ? errorMessage || "Something went wrong." : progressLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove document"
          className="shrink-0 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-ai-accent-soft-line px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setPreviewOpen((value) => !value)}
          className="flex items-center gap-1.5 rounded-full border border-ai-accent-soft-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ai-accent hover:text-ink"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {previewOpen ? "Hide document" : "View document"}
        </button>

        <button
          type="button"
          onClick={onReplace}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full border border-ai-accent-soft-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ai-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Replace
        </button>

        {status === "failed" && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-ai-accent px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ai-accent-strong"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        )}
      </div>

      {previewOpen && (
        <div className="max-h-64 overflow-y-auto border-t border-ai-accent-soft-line bg-surface p-3.5">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">{originalText}</p>
        </div>
      )}
    </div>
  );
}
