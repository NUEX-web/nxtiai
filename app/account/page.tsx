import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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
    // profiles table not provisioned yet — page still renders with
    // what auth itself already knows (email, join date).
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

      <div className="panel mt-4 flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-sm font-medium text-ink">Usage &amp; rewrite history</p>
          <p className="mt-0.5 text-xs text-ink-faint">Coming soon — this will show real usage once it ships.</p>
        </div>
        <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">Soon</span>
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
