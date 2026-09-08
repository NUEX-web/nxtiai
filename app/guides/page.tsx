import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guides — NXTIAI",
  description: "Guides for getting the most out of NXTIAI.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href="/" className="text-sm font-medium text-accent-strong underline underline-offset-2">
        ← Back to NXTIAI
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-ink">Guides</h1>
      <p className="mt-4 text-ink-soft">
        Step-by-step guides — choosing the right mode, building a voice profile that actually
        sounds like you, getting the most out of the AI Detector and Grammar Checker — are in
        progress. In the meantime, the workspace itself is built to need no guide: pick a mode,
        pick a voice, and rewrite.
      </p>
      <p className="mt-4 text-sm text-ink-faint">
        Stuck on something specific? Email{" "}
        <a href="mailto:shaikhsameerkadeer@gmail.com" className="underline underline-offset-2">
          shaikhsameerkadeer@gmail.com
        </a>{" "}
        and we&apos;ll help directly.
      </p>
    </main>
  );
}
