"use client";

import { WRITING_MODES, type ModeId } from "@/lib/modes";

interface ModeSelectorProps {
  value: ModeId;
  onChange: (mode: ModeId) => void;
}

/**
 * Vertical writing-mode list for the workspace's left settings panel. Kept
 * independent of the workspace so it can be reused elsewhere (e.g. a
 * future standalone tool page) without changes.
 */
export default function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Writing mode" className="flex flex-col gap-0.5">
      {WRITING_MODES.map((mode) => {
        const isActive = mode.id === value;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={mode.description}
            onClick={() => onChange(mode.id)}
            className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent-soft text-accent-strong"
                : "text-ink-soft hover:bg-canvas hover:text-ink"
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
