"use client";

import { BrainCircuit, ChevronRight, Gauge, Wand2 } from "lucide-react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

/**
 * Deliberately vendor-agnostic. This section used to name the specific
 * model behind every rewrite (Gemini today, OpenAI/Anthropic once
 * configured) with per-provider "Active" / "Coming soon" cards -- product
 * decision was to stop surfacing which company's model runs this,
 * without changing anything about the actual multi-provider architecture
 * underneath (see lib/server/model-config.ts, still exactly as
 * swappable as before). There is no vendor state left to render here,
 * so this is now a static, visual section: a bold claim, a short
 * feature list linking into the real workspace, and an abstract "engine"
 * visual (concentric pulses, not a screenshot or stock photo) instead of
 * naming or depicting any specific model provider.
 */
const FEATURES = [
  { label: "Streams as it writes", href: "#workspace" },
  { label: "Adapts to your mode, voice, and language", href: "#workspace" },
  { label: "Improves over time — nothing you do has to change", href: "#workspace" },
];

export default function AIEngineSection() {
  const { ref, className } = useRevealOnScroll<HTMLDivElement>();

  return (
    <section className="border-y border-line bg-canvas">
      <div ref={ref} className={`${className} mx-auto max-w-6xl px-6 py-16 md:py-24`}>
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip border border-ai-accent-soft-line bg-ai-accent-soft text-ai-accent">
            NXTIAI AI engine
          </span>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-4xl leading-[1.08] text-ink md:text-5xl">
            Powerful AI, built to feel invisible.
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Every rewrite runs through a fast, adaptable AI engine — tuned so
            the result reads like you wrote it, not like a chatbot answered you.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* LEFT — claim + feature list, each linking into the real workspace */}
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-2xl text-ink md:text-3xl">
              Think less about prompts.
              <br />
              Get better rewrites.
            </h3>
            <p className="mt-3 max-w-md text-ink-soft">
              No prompt engineering, no model picking. Pick a mode and a
              voice — the engine underneath handles the rest.
            </p>

            <ul className="mt-6 flex flex-col divide-y divide-line border-t border-line">
              {FEATURES.map((feature) => (
                <li key={feature.label}>
                  <a
                    href={feature.href}
                    className="group flex items-center justify-between gap-4 py-3.5 text-sm font-medium text-ink transition-colors hover:text-accent-strong"
                  >
                    {feature.label}
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent-strong"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT — abstract "engine" visual. No screenshot, no stock photo,
              no vendor mark -- just a pulse composition built from the same
              panel/chip primitives used elsewhere on the page. */}
          <div className="relative mx-auto flex h-80 w-full max-w-sm items-center justify-center md:h-96">
            <div className="relative flex h-52 w-52 items-center justify-center rounded-full border border-ai-accent-soft-line bg-ai-accent-soft shadow-sm md:h-60 md:w-60">
              <span
                className="animate-pulse-ring absolute inset-0 rounded-full border border-ai-accent"
                aria-hidden="true"
              />
              <span
                className="animate-pulse-ring absolute inset-0 rounded-full border border-ai-accent"
                style={{ animationDelay: "0.9s" }}
                aria-hidden="true"
              />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-ai-accent text-white shadow-md">
                <BrainCircuit className="h-8 w-8" aria-hidden="true" />
              </span>
            </div>

            <div
              className="animate-float absolute -left-2 top-4 flex items-center gap-1.5 rounded-full border border-accent-soft-line bg-surface px-3 py-1.5 text-xs font-semibold text-accent-strong shadow-sm"
              aria-hidden="true"
            >
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              Fast
            </div>
            <div
              className="animate-float absolute -right-2 bottom-6 flex items-center gap-1.5 rounded-full border border-ai-accent-soft-line bg-surface px-3 py-1.5 text-xs font-semibold text-ai-accent shadow-sm"
              style={{ animationDelay: "1s" }}
              aria-hidden="true"
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              Tuned to you
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
