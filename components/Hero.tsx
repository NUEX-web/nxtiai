"use client";

import { ArrowDown, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "./AuthProvider";

export default function Hero() {
  const { user, openAuthModal } = useAuth();

  return (
    <section className="relative overflow-hidden">
      <div className="noise-grid mint-glow pointer-events-none absolute inset-0 h-[640px]" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-6 pt-20 pb-16 md:pt-28 md:pb-24 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-10">
        {/* LEFT — positioning, headline, CTAs */}
        <div className="stagger max-w-xl">
          <span className="chip border border-accent-soft-line bg-accent-soft text-accent-strong">
            NXTIAI · AI writing workspace
          </span>

          <h1 className="mt-5 font-[family-name:var(--font-display)] text-5xl leading-[1.05] text-ink md:text-6xl lg:text-[3.75rem]">
            Write better.
            <br />
            <span className="text-accent">Rewrite smarter.</span>
          </h1>

          <p className="mt-6 max-w-md text-lg text-ink-soft">
            Write, rewrite, improve, and transform your text with AI that
            adapts to the way you write.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {user ? (
              <a
                href="#workspace"
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-accent-strong"
              >
                Go to workspace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal("signup")}
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-accent-strong"
              >
                Start writing free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <a
              href="#workspace"
              className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-line-strong"
            >
              Try the editor
            </a>
          </div>

          <a
            href="#workspace"
            className="mt-12 inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint transition-colors hover:text-ink-soft"
          >
            See it in action
            <ArrowDown className="h-3.5 w-3.5 animate-soft-pulse" aria-hidden="true" />
          </a>
        </div>

        {/* RIGHT — a real preview of what the workspace does: text goes in,
            NXTIAI rewrites it, better text comes out. Not a fake dashboard
            with invented statistics — just the actual product motion. */}
        <div className="animate-fade-in-up relative mx-auto w-full max-w-md" style={{ animationDelay: "160ms" }}>
          <div className="panel relative overflow-hidden p-5">
            <div className="flex items-center gap-1.5 border-b border-line pb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="ml-2 text-xs font-medium text-ink-faint">Writing workspace</span>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Original</p>
              <p className="mt-1.5 rounded-lg border border-line bg-canvas p-3 text-sm leading-relaxed text-ink-soft">
                This report gives information about the company&apos;s performance and shows several areas where improvements can be made.
              </p>
            </div>

            <div className="relative my-4 flex items-center justify-center">
              <div className="h-px flex-1 bg-line" aria-hidden="true" />
              <span className="animate-float mx-3 flex items-center gap-1.5 rounded-full border border-accent-soft-line bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-strong">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                NXTIAI rewriting
              </span>
              <div className="h-px flex-1 bg-line" aria-hidden="true" />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">Improved</p>
              <p className="reveal-line mt-1.5 rounded-lg border border-accent-soft-line bg-accent-soft p-3 text-sm leading-relaxed text-ink">
                The report highlights the company&apos;s performance while identifying several opportunities for improvement.
              </p>
            </div>
          </div>

          <div
            className="animate-float absolute -right-4 -top-4 hidden items-center gap-1.5 rounded-full border border-ai-accent-soft-line bg-ai-accent-soft px-3 py-1.5 text-xs font-semibold text-ai-accent shadow-sm sm:flex"
            style={{ animationDelay: "1.2s" }}
            aria-hidden="true"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-ai-accent" />
            Gemini active
          </div>
        </div>
      </div>
    </section>
  );
}
