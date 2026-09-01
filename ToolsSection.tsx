"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Fingerprint,
  GraduationCap,
  Mail,
  PenLine,
  Repeat,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  SpellCheck2,
} from "lucide-react";
import type { ComponentType } from "react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

interface Tool {
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Real mode id from lib/modes.ts this card opens the editor with. */
  mode?: string;
  comingSoon?: boolean;
}

const TOOLS: Tool[] = [
  { name: "Paraphraser", description: "Rephrase any text while keeping the meaning intact.", icon: Repeat, mode: "standard" },
  { name: "Grammar Checker", description: "Catch grammar, spelling and punctuation issues.", icon: SpellCheck2, comingSoon: true },
  { name: "Summarizer", description: "Turn long text into a short, accurate summary.", icon: ScanSearch, mode: "shorten" },
  { name: "Humanizer", description: "Make AI-generated text read naturally.", icon: Sparkles, mode: "humanize" },
  { name: "AI Writer", description: "Draft new content from a topic or outline.", icon: PenLine, mode: "standard" },
  { name: "Academic Writer", description: "Write in a formal, citation-ready register.", icon: GraduationCap, mode: "academic" },
  { name: "Email Writer", description: "Compose clear emails for any situation.", icon: Mail, mode: "email" },
  { name: "Brand Voice", description: "Keep every piece of content on-brand.", icon: Fingerprint, comingSoon: true },
  { name: "AI Detector", description: "Check whether text reads as AI-written.", icon: ShieldCheck, comingSoon: true },
];

export default function ToolsSection() {
  const { ref, className } = useRevealOnScroll<HTMLDivElement>();

  return (
    <section id="tools" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div ref={ref} className={className}>
      <div className="mb-10 max-w-xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-ink md:text-4xl">
          One workspace, every writing task.
        </h2>
        <p className="mt-3 text-ink-soft">
          NXTIAI brings the tools you switch between into a single place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;

          if (tool.comingSoon) {
            return (
              <div
                key={tool.name}
                className="flex flex-col gap-3 bg-surface px-5 py-6 opacity-60"
              >
                <Icon className="h-5 w-5 text-ink-faint" aria-hidden="true" />
                <div className="flex flex-1 flex-col">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    {tool.name}
                    <span className="rounded-full bg-line px-1.5 py-0.5 text-[9px] font-semibold uppercase text-ink-soft">
                      Soon
                    </span>
                  </span>
                  <span className="mt-1 text-sm text-ink-soft">{tool.description}</span>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={tool.name}
              href={`/?mode=${tool.mode}#workspace`}
              className="group flex flex-col gap-3 bg-surface px-5 py-6 transition-colors hover:bg-accent-soft"
            >
              <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
              <div className="flex flex-1 flex-col">
                <span className="font-medium text-ink">{tool.name}</span>
                <span className="mt-1 text-sm text-ink-soft">{tool.description}</span>
              </div>
              <ArrowUpRight
                className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-strong"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
      </div>
    </section>
  );
}
