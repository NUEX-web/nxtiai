"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      // This only succeeds when arriving here via a valid Supabase
      // password-recovery link — auth/callback/route.ts already
      // exchanged that link's code for a session before redirecting here.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your password. Try the reset link again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <span className="text-2xl font-medium tracking-tight text-ink">NXTIAI</span>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-ink">Set a new password</h1>

      {done ? (
        <div className="mt-6 rounded-xl border border-success/25 bg-success-soft p-4 text-sm text-success">
          Your password has been updated.{" "}
          <Link href="/" className="font-medium underline underline-offset-2">
            Return to NXTIAI
          </Link>
          .
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          {error && (
            <div className="rounded-xl border border-danger/25 bg-danger-soft p-3 text-xs text-danger">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">New password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line bg-canvas py-2 pl-9 pr-3 text-sm text-ink focus-visible:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Confirm new password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-line bg-canvas py-2 pl-9 pr-3 text-sm text-ink focus-visible:border-accent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </button>
        </form>
      )}
    </main>
  );
}
