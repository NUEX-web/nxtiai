"use client";

import { useState } from "react";
import { X, Loader2, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "signup";
}

type Mode = "login" | "signup" | "reset";

function isLikelyNetworkError(err: unknown): boolean {
  // A raw, un-wrapped fetch() rejection is a bare TypeError — always a
  // network failure (DNS/connection/CORS failure, never a real HTTP
  // response).
  if (err instanceof TypeError) return true;
  if (!(err instanceof Error)) return false;

  // Supabase's AuthError/AuthApiError classes declare a `status` field
  // in their constructor for EVERY instance, including ones built from
  // a network-level failure that never got a response — so checking
  // whether the key exists (the previous `!("status" in err)` check)
  // never actually excludes a wrapped network error, it only ever
  // matches a bare TypeError. A real HTTP response status (400 for bad
  // credentials, 422, etc.) is what should stop this from firing —
  // check for a genuine positive status code instead of key presence.
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number" && status > 0) return false;

  // Covers Supabase's own wrapped version of a fetch failure, whose
  // message is still literally "Failed to fetch" (or similar) even
  // though the object itself isn't a plain TypeError anymore.
  return /fetch|network/i.test(err.message);
}

export default function AuthModal({ isOpen, onClose, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const supabase = createClient();

  const resetFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    resetFeedback();
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !agreedToTerms) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    resetFeedback();

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage("Check your email for the confirmation link to complete registration!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        setError("Network error — check your connection and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetFeedback();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/account/reset-password`,
      });
      if (error) throw error;
      setMessage("If an account exists for that email, a reset link is on its way.");
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        setError("Network error — check your connection and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Couldn't send the reset link. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    resetFeedback();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Environment-aware by construction: window.location.origin is
          // whatever host actually served this page (localhost:3001 in
          // dev, https://nxtiai.com in production) — never hardcoded.
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        setError("Network error — check your connection and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Google sign in failed.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-lg md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-accent-soft hover:text-ink"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 text-center">
          <span className="text-2xl font-medium tracking-tight text-ink">NXTIAI</span>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-ink">
            {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {mode === "login"
              ? "Sign in to access your personal voice profiles & history"
              : mode === "signup"
                ? "Start writing with AI that sounds like you"
                : "We'll email you a link to set a new password"}
          </p>
        </div>

        {mode !== "reset" && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-canvas py-2.5 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs uppercase text-ink-faint">or email</span>
              <div className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-danger/25 bg-danger-soft p-3 text-xs text-danger">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-success/25 bg-success-soft p-3 text-xs text-success">
            {message}
          </div>
        )}

        {mode === "reset" ? (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-line bg-canvas py-2 pl-9 pr-3 text-sm text-ink focus-visible:border-accent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-xl border border-line bg-canvas py-2 pl-9 pr-3 text-sm text-ink focus-visible:border-accent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-line bg-canvas py-2 pl-9 pr-3 text-sm text-ink focus-visible:border-accent"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-ink-soft">Password</label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => switchMode("reset")}
                    className="text-xs font-medium text-ink-faint underline underline-offset-2 hover:text-ink-soft"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-line bg-canvas py-2 pl-9 pr-3 text-sm text-ink focus-visible:border-accent"
                />
              </div>
            </div>

            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-line-strong text-accent focus-visible:outline-accent"
                />
                <span>
                  I agree to the{" "}
                  <a href="/terms" target="_blank" className="font-medium text-accent-strong underline underline-offset-2">
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" target="_blank" className="font-medium text-accent-strong underline underline-offset-2">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-ink-soft">
          {mode === "reset" ? (
            <p>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-medium text-accent-strong underline underline-offset-2 hover:text-accent"
              >
                Back to sign in
              </button>
            </p>
          ) : mode === "login" ? (
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-medium text-accent-strong underline underline-offset-2 hover:text-accent"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-medium text-accent-strong underline underline-offset-2 hover:text-accent"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
