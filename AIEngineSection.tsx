"use client";

import { Check } from "lucide-react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

export interface EngineStatus {
  id: "gemini" | "openai" | "anthropic";
  label: string;
  description: string;
  active: boolean;
}

interface AIEngineSectionProps {
  engines: EngineStatus[];
}

/**
 * Purely a status display — `engines` is computed server-side in page.tsx
 * from isProviderConfigured(), the same server-only check the workspace's
 * model selector uses. Nothing here is clickable for an inactive engine,
 * and nothing here can drift out of sync with which providers are
 * actually configured.
 */
export default function AIEngineSection({ engines }: AIEngineSectionProps) {
  const { ref, className } = useRevealOnScroll<HTMLDivElement>();

  return (
    <section className="border-y border-line bg-canvas">
      <div ref={ref} className={`${className} mx-auto max-w-6xl px-6 py-16 md:py-24`}>
        <div className="max-w-xl">
          <span className="chip border border-ai-accent-soft-line bg-ai-accent-soft text-ai-accent">
            NXTIAI AI engine
          </span>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-ink md:text-4xl">
            Choose the AI engine that fits your workflow.
          </h2>
          <p className="mt-3 text-ink-soft">
            NXTIAI is built to run on more than one model. Today, every
            rewrite runs on Gemini — support for additional engines is
            already wired into the architecture and switches on as each
            one is configured.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {engines.map((engine) => (
            <div
              key={engine.id}
              className={`flex flex-col gap-3 rounded-2xl border p-5 ${
                engine.active
                  ? "border-accent-soft-line bg-accent-soft/60"
                  : "border-line bg-surface opacity-70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">{engine.label}</span>
                {engine.active ? (
                  <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-soft">{engine.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
