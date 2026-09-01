import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="text-2xl font-medium tracking-tight text-ink">NXTIAI</span>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-ink">Page not found</h1>
      <p className="mt-3 text-sm text-ink-soft">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-7 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
      >
        Back to NXTIAI
      </Link>
    </main>
  );
}
