"use client";

import { ClipboardPaste, Sliders, Sparkles } from "lucide-react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const STEPS = [
  {
    number: "01",
    title: "Paste your text",
    description: "Drop in a sentence, a paragraph, or a full draft.",
    icon: ClipboardPaste,
  },
  {
    number: "02",
    title: "Choose how you want it written",
    description: "Pick a mode, a voice, and a language.",
    icon: Sliders,
  },
  {
    number: "03",
    title: "Get writing that sounds like you",
    description: "Review the result and copy it straight into your work.",
    icon: Sparkles,
  },
];

export default function HowItWorks() {
  const { ref, className } = useRevealOnScroll<HTMLDivElement>();

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div ref={ref} className={className}>
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-ink md:text-4xl">
          How it works
        </h2>

        <ol className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.number} className="border-t-2 border-accent-soft-line pt-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-2xl text-ink-faint">
                    {step.number}
                  </span>
                </div>
                <h3 className="mt-3 font-medium text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm text-ink-soft">{step.description}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
