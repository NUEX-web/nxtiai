import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — NXTIAI",
  description: "Writing, product, and AI notes from the NXTIAI team.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href="/" className="text-sm font-medium text-accent-strong underline underline-offset-2">
        ← Back to NXTIAI
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-ink">Blog</h1>
      <p className="mt-4 text-ink-soft">
        We&apos;re writing our first posts on better writing, how NXTIAI&apos;s AI engine works
        under the hood, and what we&apos;re shipping next. Nothing published yet — check back
        soon, or email us and we&apos;ll let you know the moment the first post is live.
      </p>
      <p className="mt-4 text-sm text-ink-faint">
        Get notified at{" "}
        <a href="mailto:shaikhsameerkadeer@gmail.com?subject=Notify%20me%20when%20the%20NXTIAI%20blog%20launches" className="underline underline-offset-2">
          shaikhsameerkadeer@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
