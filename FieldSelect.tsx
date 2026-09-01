"use client";

import { ChevronDown } from "lucide-react";

export interface FieldSelectOption {
  id: string;
  label: string;
}

interface FieldSelectProps {
  id: string;
  label: string;
  value: string;
  options: FieldSelectOption[];
  onChange: (value: string) => void;
  /** Option ids to render as disabled, with a "(Coming soon)" suffix. */
  disabledIds?: string[];
}

/**
 * Reusable labelled dropdown used for Voice / AI model / Language controls.
 * Built on a native <select> for full keyboard and screen-reader support.
 */
export default function FieldSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabledIds,
}: FieldSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ink-faint">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-lg border border-line bg-surface py-2 pl-3 pr-8 text-sm text-ink transition-colors hover:border-line-strong focus-visible:border-accent"
        >
          {options.map((option) => {
            const isDisabled = disabledIds?.includes(option.id) ?? false;
            return (
              <option key={option.id} value={option.id} disabled={isDisabled}>
                {option.label}
                {isDisabled ? " (Coming soon)" : ""}
              </option>
            );
          })}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        />
      </div>
    </div>
  );
}
