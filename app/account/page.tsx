import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AI_MODEL_OPTIONS, LANGUAGE_OPTIONS, VOICE_OPTIONS, WRITING_MODES } from "@/lib/modes";

export const metadata = {
  title: "Your account — NXTIAI",
};

// This page reads the signed-in user's Supabase session (via cookies)
// and their profile row on every load, so its output is inherently
// per-request and per-user -- it must never be statically generated or
// cached. Next.js normally infers this automatically from the
// cookies()/auth call below, but that inference only happens if this
// Server Component actually gets to execute during the build's
// prerender attempt. app/layout.tsx wraps every route in
// <AuthProvider>, a client component whose useState lazy initializer
// runs first (parents render before children) and constructs the
// Supabase browser client synchronously -- so an exception in that
// client construction step (env misconfiguration, a transient SDK
// issue, etc.) aborts the render before Next.js ever reaches the code
// below and discovers it needs cookies(), which surfaces as a hard
// prerender error instead of "skip static generation for this route."
// Declaring dynamic rendering explicitly here removes that race
// entirely: Next reads this exported const during its static
// route-segment analysis, before attempting to render anything, and
// never tries to statically prerender this route in the first place.
export const dynamic = "force-dynamic";

interface ProfileRow {
  full_name: string | null;
  plan_tier: "free" | "pro" | "business" | null;
}

interface RewriteHistoryRow {
  id: string;
  mode: string;
  voice: string;
  ai_model: string;
  language: string;
  latency_ms: number | null;
  created_at: string;
}

const MODE_LABELS = Object.fromEntries(WRITING_MODES.map((m) => [m.id, m.label]));
const VOICE_LABELS = Object.fromEntries(VOICE_OPTIONS.map((v) => [v.id, v.label]));
const MODEL_LABELS = Object.fromEntries(AI_MODEL_OPTIONS.map((m) => [m.id, m.label]));
const LANGUAGE_LABELS = Object.fromEntries(LANGUAGE_OPTIONS.map((l) => [l.id, l.label]));

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  let profile: ProfileRow | null = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, plan_tier")
      .eq("id", user.id)
      .single();
    profile = data;
  } catch {
    // profiles table not provisioned yet -- page still renders with
    // what auth itself already knows (email, join date).
  }

  // Usage & rewrite history: rewrites_history is written to on every
  // successful rewrite for a signed-in user (see app/api/rewrite/route.ts).
  // Reading it back here is the only new work this page needed -- the
  // data pipeline already existed. Same defensive try/catch pattern as
  // the profile lookup above: a not-yet-provisioned table on a fresh
  // Supabase project must never break this page.
  let history: RewriteHistoryRow[] = [];
  let historyUnavailable = false;
  try {
    const { data, error } = await supabase
      .from("rewrites_history")
      .select("id, mode, voice, ai_model, language, latency_ms, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    history = data ?? [];
  } catch {
    historyUnavailable = true;
  }

  const joined = new Date(user.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to NXTIAI
      </Link>

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-ink">Your account</h1>

      <div className="panel mt-8 divide-y divide-line">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-soft">Email</span>
          <span className="text-sm font-medium text-ink">{user.email}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-soft">Name</span>
          <span className="text-sm font-medium text-ink">{profile?.full_name || "Not set"}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-soft">Plan</span>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold uppercase text-accent-strong">
            {profile?.plan_tier || "free"}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-soft">Member since</span>
          <span className="text-sm font-medium text-ink">{joined}</span>
        </div>
      </div>

      <div id="usage" className="panel mt-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Usage &amp; rewrite history</p>
          {!historyUnavailable && history.length > 0 && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-accent-strong">
              Last {history.length}
            </span>
          )}
        </div>

        {historyUnavailable ? (
          <p className="mt-3 text-xs text-ink-faint">Usage history isn&apos;t available right now &mdash; try again in a moment.</p>
        ) : history.length === 0 ? (
          <p className="mt-3 text-xs text-ink-faint">No rewrites yet. Head to the writing workspace to get started.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {history.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">{MODE_LABELS[row.mode] ?? row.mode}</p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                    {VOICE_LABELS[row.voice] ?? "Custom voice"} &middot; {LANGUAGE_LABELS[row.language] ?? row.language} &middot;{" "}
                    {MODEL_LABELS[row.ai_model] ?? row.ai_model}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-ink-faint">
                    {new Date(row.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  {typeof row.latency_ms === "number" && (
                    <p className="mt-0.5 text-[10px] text-ink-faint">{row.latency_ms}ms</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/#workspace"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
      >
        Go to writing workspace
      </Link>
    </main>
  );
}
