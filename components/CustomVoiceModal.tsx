"use client";

import { useState } from "react";
import { X, Loader2, Sparkles, Plus } from "lucide-react";
import { useAuth } from "./AuthProvider";

interface CustomVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceCreated: () => void;
}

export default function CustomVoiceModal({ isOpen, onClose, onVoiceCreated }: CustomVoiceModalProps) {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [tone, setTone] = useState("conversational, confident and direct");
  const [formality, setFormality] = useState<"low" | "neutral" | "high">("neutral");
  const [vocabularyLevel, setVocabularyLevel] = useState<"simple" | "standard" | "advanced">("standard");
  const [customInstructions, setCustomInstructions] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Please sign in to create personal voice profiles.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tone,
          formality,
          vocabularyLevel,
          customInstructions,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create voice profile.");
      }

      onVoiceCreated();
      onClose();
      // Reset form
      setName("");
      setCustomInstructions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating voice profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-2xl md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-accent-soft hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
              Create Personal Voice
            </h2>
            <p className="text-xs text-ink-soft">
              Configure how NXTIAI rewrites your text to match your style
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              Voice Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Founder Newsletter, Technical Blog, Chill Email"
              className="w-full rounded-xl border border-line bg-canvas py-2 px-3 text-sm text-ink focus-visible:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              Tone Description
            </label>
            <input
              type="text"
              required
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. empathetic, sharp, optimistic, concise"
              className="w-full rounded-xl border border-line bg-canvas py-2 px-3 text-sm text-ink focus-visible:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">
                Formality
              </label>
              <select
                value={formality}
                onChange={(e) => setFormality(e.target.value as "low" | "neutral" | "high")}
                className="w-full rounded-xl border border-line bg-canvas py-2 px-3 text-sm text-ink focus-visible:border-accent"
              >
                <option value="low">Low (Casual)</option>
                <option value="neutral">Neutral</option>
                <option value="high">High (Formal)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">
                Vocabulary Level
              </label>
              <select
                value={vocabularyLevel}
                onChange={(e) => setVocabularyLevel(e.target.value as "simple" | "standard" | "advanced")}
                className="w-full rounded-xl border border-line bg-canvas py-2 px-3 text-sm text-ink focus-visible:border-accent"
              >
                <option value="simple">Simple & Plain</option>
                <option value="standard">Standard</option>
                <option value="advanced">Advanced / Academic</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              Custom Instructions (Optional)
            </label>
            <textarea
              rows={3}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Always use active voice. Never use corporate buzzwords like synergy or leverage."
              className="w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm text-ink placeholder:text-ink-faint focus-visible:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Save Voice Profile
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
