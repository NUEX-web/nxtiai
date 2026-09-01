"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { ModeId } from "@/lib/modes";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

interface Example {
  mode: ModeId;
  label: string;
  original: string;
  rewritten: string;
}

// Only modes that are real, working options in the editor today (see
// lib/modes.ts) — a fixed demonstration pair per mode, not a live call to
// /api/rewrite. Labelled "Example" throughout so it's never mistaken for
// the real editor above.
const EXAMPLES: Example[] = [
  {
    mode: "standard",
    label: "Standard",
    original:
      "This report gives information about the company's performance and shows several areas where improvements can be made.",
    rewritten:
      "The report highlights the company's performance while identifying several opportunities for improvement.",
  },
  {
    mode: "professional",
    label: "Professional",
    original: "Hey, just wanted to let you know the numbers came in late and we're still figuring out why.",
    rewritten:
      "This is to confirm that the figures were delayed; we are currently investigating the cause and will follow up shortly.",
  },
  {
    mode: "academic",
    label: "Academic",
    original: "The results show that people who slept more did better on the memory test.",
    rewritten:
      "The findings indicate a positive correlation between sleep duration and performance on the memory assessment.",
  },
  {
    mode: "creative",
    label: "Creative",
    original: "The coffee shop was busy in the morning and people were waiting in line.",
    rewritten: "Every morning, the little coffee shop hummed with life, a queue curling out the door like smoke.",
  },
  {
    mode: "humanize",
    label: "Humanize",
    original: "The implementation of the aforementioned strategy resulted in a significant enhancement of operational efficiency.",
    rewritten: "Putting that strategy in place made a real difference in how efficiently things ran.",
  },
];

export default function BeforeAfter() {
  const [activeMode, setActiveMode] = useState<ModeId>("standard");
  const { ref, className } = useRevealOnScroll<HTMLDivElement>();

  const active = EXAMPLES.find((example) => example.mode === activeMode) ?? EXAMPLES[0];

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div ref={ref} className={className}>
        <div className="max-w-xl">
          <span className="chip border border-line bg-surface text-ink-soft">Example</span>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-ink md:text-4xl">
            See the difference, mode by mode.
          </h2>
          <p className="mt-3 text-ink-soft">
            The same sentence, rewritten five different ways — a fixed example, not a live call to the editor.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Writing mode example">
          {EXAMPLES.map((example) => (
            <button
              key={example.mode}
              type="button"
              role="tab"
              aria-selected={activeMode === example.mode}
              onClick={() => setActiveMode(example.mode)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                activeMode === example.mode
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink"
              }`}
            >
              {example.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Original</p>
            <p key={`${active.mode}-original`} className="reveal-line mt-2 text-[15px] leading-relaxed text-ink-soft">
              {active.original}
            </p>
          </div>

          <div className="flex justify-center py-2 lg:rotate-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-accent-soft-line bg-accent-soft text-accent-strong">
              <ArrowRight className="h-4 w-4 rotate-90 lg:rotate-0" aria-hidden="true" />
            </span>
          </div>

          <div className="panel border-accent-soft-line bg-accent-soft p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">NXTIAI · {active.label}</p>
            <p key={`${active.mode}-rewritten`} className="reveal-line mt-2 text-[15px] leading-relaxed text-ink">
              {active.rewritten}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
