import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAuthEvent } from "@/lib/server/auth-notify";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Covers Google OAuth (every sign-in) and email-confirmation link
      // clicks (the only server-side moment a password signup can be
      // verified genuinely complete). Best-effort and awaited so it
      // actually runs to completion before this serverless response
      // returns, but a failure here must never block the redirect --
      // see lib/server/auth-notify.ts for why this never throws.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) await notifyAuthEvent(supabase, user, origin);
      } catch (notifyError) {
        console.error(
          "[auth-callback] notification failed:",
          notifyError instanceof Error ? notifyError.message : notifyError
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page or homepage if auth code exchange failed
  return NextResponse.redirect(`${origin}/?auth_error=could_not_authenticate`);
}
