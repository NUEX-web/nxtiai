"use client";

import { useEffect, useState } from "react";
import { X, Copy, Trash2, RotateCcw, Clock, Check } from "lucide-react";
import { useAuth } from "./AuthProvider";

export interface RewriteHistoryItem {
  id: string;
  input_text: string;
  output_text: string;
  mode: string;
  voice: string;
  ai_model: string;
  language: string;
  latency_ms: number;
  created_at: string;
}

interface RewriteHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRewrite: (input: string, output: string) => void;
}

export default function RewriteHistoryDrawer({ isOpen, onClose, onSelectRewrite }: RewriteHistoryDrawerProps) {
  const { user } = useAuth();
  // null = "not fetched yet for the current open" (renders the loading
  // state); an array (possibly empty) = a real, loaded result. This is the
  // whole loading indicator — no separate boolean to keep in sync with it.
  const [history, setHistory] = useState<RewriteHistoryItem[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;

    let ignore = false;

    async function loadHistory() {
      try {
        const response = await fetch("/api/history");
        const data = await response.json();
        if (!ignore) {
          setHistory(Array.isArray(data.history) ? data.history : []);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
        if (!ignore) {
          setHistory([]);
        }
      }
    }

    loadHistory();

    return () => {
      ignore = true;
    };
  }, [isOpen, user]);

  const handleDeleteItem = async (id: string) => {
    try {
      await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      setHistory((prev) => (prev ?? []).filter((item) => item.id !== id));
    } catch (error) {
      console.error("Failed to delete history item:", error);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all rewrite history?")) return;
    try {
      await fetch("/api/history", { method: "DELETE" });
      setHistory([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/30 backdrop-blur-xs">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-surface border-l border-line shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" />
              <h2 className="font-[family-name:var(--font-display)] text-xl text-ink">
                Rewrite History
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {history && history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-ink-faint hover:text-red-600 transition-colors mr-2"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-ink-faint hover:bg-accent-soft hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!user ? (
              <div className="py-12 text-center text-sm text-ink-soft">
                Sign in to automatically save and view your rewrite history.
              </div>
            ) : history === null ? (
              <div className="py-12 text-center text-sm text-ink-faint animate-pulse">
                Loading history…
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-sm text-ink-soft">
                No past rewrites yet. Use the workspace to start rewriting!
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-line bg-canvas p-4 text-xs space-y-2.5 transition-colors hover:border-line-strong"
                >
                  <div className="flex items-center justify-between text-[11px] text-ink-faint">
                    <span className="capitalize bg-accent-soft text-accent-strong font-medium px-2 py-0.5 rounded-full">
                      {item.mode} mode
                    </span>
                    <span>
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div>
                    <p className="font-medium text-ink-faint text-[11px] mb-0.5">Original:</p>
                    <p className="line-clamp-2 text-ink-soft italic bg-surface p-2 rounded-lg border border-line">
                      {item.input_text}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-accent-strong text-[11px] mb-0.5">Result:</p>
                    <p className="line-clamp-3 text-ink bg-surface p-2 rounded-lg border border-accent-soft-line">
                      {item.output_text}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectRewrite(item.input_text, item.output_text);
                        onClose();
                      }}
                      className="flex items-center gap-1 text-accent-strong font-medium hover:underline"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Load in Editor
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(item.id, item.output_text)}
                        className="flex items-center gap-1 text-ink-soft hover:text-ink"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-3.5 w-3.5 text-accent" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-ink-faint hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
