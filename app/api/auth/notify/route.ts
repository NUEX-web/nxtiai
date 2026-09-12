import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAuthEvent } from "@/lib/server/auth-notify";
import { checkRateLimit } from "@/lib/server/rate-limiter";

/**
 * Called by components/AuthProvider.tsx exactly once per client-observed
 * "SIGNED_IN" auth-state-change event -- the only server touchpoint that
 * exists for plain email/password login, since
 * supabase.auth.signInWithPassword() is a direct browser-to-Supabase
 * call that never otherwise reaches this app's own server.
 *
 * Identity is never taken from the request body -- only from the
 * caller's own Supabase session cookie, verified server-side via
 * getUser() (which round-trips to Supabase, unlike getSession()). A
 * signed-out caller, or a request whose cookie doesn't verify, gets a
 * 401 and nothing is sent. Real deduplication (so this can be called
 * more than once, e.g. from multiple open tabs, without ever sending
 * more than one email per genuine login) lives in
 * lib/server/auth-notify.ts, not here.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // Defense-in-depth only -- lib/server/auth-notify.ts's DB-level
    // dedup already makes repeated calls a cheap no-op after the first,
    // so this just caps how often a signed-in caller can make this
    // endpoint do a DB round-trip at all.
    const rateLimit = checkRateLimit(`auth-notify:${user.id}`);
    if (!rateLimit.allowed) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const { origin } = new URL(request.url);
    await notifyAuthEvent(supabase, user, origin);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth-notify-route] unexpected error:", error instanceof Error ? error.message : error);
    // Never surface details -- and never a non-2xx that might make a
    // caller think their actual sign-in failed. This endpoint's own
    // failure must be invisible to the user.
    return NextResponse.json({ ok: false });
  }
}
