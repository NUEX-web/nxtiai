import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — NXTIAI",
  description: "What NXTIAI is and why we're building it.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href="/" className="text-sm font-medium text-accent-strong underline underline-offset-2">
        ← Back to NXTIAI
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-ink">About NXTIAI</h1>
      <p className="mt-4 text-ink-soft">
        NXTIAI is an AI writing workspace built to do one thing well: take text you&apos;ve
        already written and make it better — clearer, more polished, and in the tone you
        actually need — without you having to think about prompts or which AI model to pick.
      </p>
      <p className="mt-4 text-ink-soft">
        We&apos;re in early access, built and run by a small, independent team. The product is
        under active development, and the roadmap is shaped directly by what early users tell
        us they need.
      </p>
      <p className="mt-4 text-sm text-ink-faint">
        Questions, feedback, or press? Reach us at{" "}
        <a href="mailto:shaikhsameerkadeer@gmail.com" className="underline underline-offset-2">
          shaikhsameerkadeer@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
