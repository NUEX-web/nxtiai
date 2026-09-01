import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — NXTIAI",
  description: "NXTIAI's terms of service.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href="/" className="text-sm font-medium text-accent-strong underline underline-offset-2">
        ← Back to NXTIAI
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-ink">Terms of Service</h1>
      <p className="mt-4 text-ink-soft">
        NXTIAI is in early access, and our full Terms of Service are still being finalized. This
        placeholder exists so account creation never links to a page that doesn&apos;t exist —
        the published terms will appear here before NXTIAI leaves early access.
      </p>
      <p className="mt-4 text-sm text-ink-faint">
        Questions in the meantime? Reach us at{" "}
        <a href="mailto:hello@nxtiai.com" className="underline underline-offset-2">
          hello@nxtiai.com
        </a>
        .
      </p>
    </main>
  );
}
