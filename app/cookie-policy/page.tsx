import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — NXTIAI",
  description: "NXTIAI's cookie policy.",
  alternates: { canonical: "/cookie-policy" },
};

export default function CookiePolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href="/" className="text-sm font-medium text-accent-strong underline underline-offset-2">
        ← Back to NXTIAI
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-ink">Cookie Policy</h1>
      <p className="mt-4 text-ink-soft">
        NXTIAI uses cookies only where they&apos;re strictly necessary to run the product —
        nothing else, today.
      </p>
      <h2 className="mt-8 text-lg font-medium text-ink">Strictly necessary cookies</h2>
      <p className="mt-2 text-ink-soft">
        When you sign in, our authentication provider (Supabase) sets a session cookie so you
        stay signed in between visits and so requests to your account can be verified as
        coming from you. Without it, sign-in wouldn&apos;t work. These cookies aren&apos;t used
        for tracking, advertising, or shared with anyone outside of keeping you signed in.
      </p>
      <h2 className="mt-8 text-lg font-medium text-ink">Analytics and advertising cookies</h2>
      <p className="mt-2 text-ink-soft">
        NXTIAI does not currently use any analytics, tracking, or advertising cookies. If that
        changes, this page will be updated first and you&apos;ll be asked for consent where
        required.
      </p>
      <p className="mt-8 text-sm text-ink-faint">
        Questions about this policy? Email{" "}
        <a href="mailto:shaikhsameerkadeer@gmail.com" className="underline underline-offset-2">
          shaikhsameerkadeer@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
