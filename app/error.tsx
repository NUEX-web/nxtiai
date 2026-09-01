"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="text-2xl font-medium tracking-tight text-ink">NXTIAI</span>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-ink">Something went wrong</h1>
      <p className="mt-3 text-sm text-ink-soft">
        An unexpected error occurred. You can try again, or head back to the homepage.
      </p>
      <div className="mt-7 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-line px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-line-strong"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
