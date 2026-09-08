import Link from "next/link";
import type { Metadata } from "next";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is my text stored or used to train models?",
    a: "Signed-in users' rewrite history is saved to their own account so they can revisit past results, and is never used to train any AI model. See the Privacy Policy for details.",
  },
  {
    q: "Which modes actually change meaning vs. just tone?",
    a: "Expand, Shorten, and Simplify intentionally change length. Every other mode — Standard, Academic, Professional, Creative, Humanize, Legal Simplifier, Email, and Grammar Checker — is instructed to preserve your original meaning.",
  },
  {
    q: "How accurate is the AI Detector?",
    a: "It's a genuine estimate, not a certainty — no AI detector, from any vendor, can verify authorship with full confidence. Treat the result as a signal, not a verdict.",
  },
  {
    q: "How do I cancel or change my plan?",
    a: "From your account page once signed in. If anything looks wrong with billing, email us directly and we'll sort it out quickly.",
  },
];

export const metadata: Metadata = {
  title: "Help Center — NXTIAI",
  description: "Answers to common NXTIAI questions.",
  alternates: { canonical: "/help" },
};

export default function HelpCenterPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href="/" className="text-sm font-medium text-accent-strong underline underline-offset-2">
        ← Back to NXTIAI
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-ink">Help Center</h1>
      <p className="mt-4 text-ink-soft">
        A full help center is on the way. For now, here are answers to the questions we hear
        most:
      </p>
      <div className="mt-8 flex flex-col gap-6">
        {FAQS.map((item) => (
          <div key={item.q}>
            <h2 className="text-base font-medium text-ink">{item.q}</h2>
            <p className="mt-1.5 text-sm text-ink-soft">{item.a}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-sm text-ink-faint">
        Didn&apos;t find your answer? Email{" "}
        <a href="mailto:shaikhsameerkadeer@gmail.com" className="underline underline-offset-2">
          shaikhsameerkadeer@gmail.com
        </a>{" "}
        and we&apos;ll reply directly.
      </p>
    </main>
  );
}
