"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { FileText, Paperclip, Type } from "lucide-react";

export interface AddProjectMenuOption {
  id: "pdf" | "word" | "text";
  label: string;
  hint: string;
  accept: string;
  icon: typeof FileText;
}

const OPTIONS: AddProjectMenuOption[] = [
  { id: "pdf", label: "PDF", hint: ".pdf", accept: ".pdf,application/pdf", icon: FileText },
  {
    id: "word",
    label: "Word document",
    hint: ".doc, .docx",
    accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    icon: FileText,
  },
  { id: "text", label: "Plain text", hint: ".txt", accept: ".txt,text/plain", icon: Type },
];

interface AddProjectMenuProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

/** "Add Project" — the document-upload entry point next to Paste/Clear.
 * Uses the indigo AI/file accent (--ai-accent) rather than NXTIAI's green,
 * per design direction: uploaded-file affordances are visually distinct
 * from the primary green Rewrite action. */
export default function AddProjectMenu({ onFileSelected, disabled }: AddProjectMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pendingAccept, setPendingAccept] = useState(OPTIONS[0].accept);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleOptionClick = useCallback((accept: string) => {
    setPendingAccept(accept);
    setOpen(false);
    // Defer to the next tick so the input's `accept` attribute (set via
    // state) is committed to the DOM before the picker opens -- matters
    // on mobile, where the OS reads `accept` at click time to filter the
    // document picker (Files / iCloud Drive / Google Drive).
    requestAnimationFrame(() => inputRef.current?.click());
  }, []);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ""; // allow re-selecting the same file next time
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-ai-accent-soft-line bg-ai-accent-soft px-3.5 py-2 text-xs font-medium text-ai-accent-strong transition-colors hover:border-ai-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
        Add Project
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          <p className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Add to NXTIAI
          </p>
          <div className="p-1.5">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleOptionClick(option.accept)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-ai-accent-soft"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ai-accent-soft text-ai-accent-strong">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-xs text-ink-faint">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={pendingAccept}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
