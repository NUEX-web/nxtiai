"use client";

import { Briefcase, GraduationCap, PenTool, Users } from "lucide-react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const AUDIENCES = [
  { label: "Students", description: "Clear, well-structured academic writing.", icon: GraduationCap },
  { label: "Professionals", description: "Polished emails, reports and proposals.", icon: Briefcase },
  { label: "Creators", description: "Content that keeps its own voice.", icon: PenTool },
  { label: "Teams", description: "One shared workspace for everyone.", icon: Users },
];

export default function TrustSection() {
  const { ref, className } = useRevealOnScroll<HTMLDivElement>();

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <div ref={ref} className={className}>
        <p className="text-center text-sm font-medium text-ink-faint">
          Built for students, professionals, creators and teams.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {AUDIENCES.map((audience) => {
            const Icon = audience.icon;
            return (
              <div
                key={audience.label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-6 text-center"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-ink">{audience.label}</span>
                <span className="text-xs text-ink-soft">{audience.description}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
