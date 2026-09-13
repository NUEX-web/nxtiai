/**
 * Ties a genuine, server-verified authentication event to exactly the
 * right emails -- and no more.
 *
 * Called from two places, both after Supabase has already confirmed the
 * caller is who they say they are:
 *  - app/auth/callback/route.ts, after a successful
 *    exchangeCodeForSession() -- covers Google OAuth (every sign-in,
 *    first or returning) and email-confirmation link clicks (the only
 *    server-side moment a password-based signup can be verified as
 *    genuinely complete, since Supabase requires confirming the email
 *    before a session exists).
 *  - app/api/auth/notify/route.ts, called by components/AuthProvider.tsx
 *    only on a client-observed "SIGNED_IN" auth event -- the only path
 *    that exists for plain email/password login, which never touches
 *    our server at all otherwise (supabase.auth.signInWithPassword() is
 *    a direct browser-to-Supabase call).
 *
 * Both call sites can legitimately fire for the same login (e.g. a
 * Google sign-in hits the callback route AND may also surface a
 * SIGNED_IN event client-side), and the client-side path itself can
 * legitimately fire more than once for one real login (multiple open
 * tabs replaying the same auth-state change, a component remount). This
 * module is the single place that makes all of that idempotent, via two
 * atomic, race-safe UPDATE ... WHERE ... RETURNING statements against
 * profiles -- never a client-supplied "trust me, this is a new login"
 * flag.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { sendOwnerAlertEmail } from "./email";
import { sendCustomerWelcomeEmail, sendCustomerLoginEmail } from "./customer-email";

function getProviderLabel(user: User): string {
  const provider = user.app_metadata?.provider;
  if (provider === "google") return "Google";
  if (provider === "email") return "Email";
  return typeof provider === "string" && provider ? provider : "Unknown";
}

function getDisplayName(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name ?? meta.name) as string | undefined;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

const SESSION_ID_PATTERN = /^[0-9a-f-]{16,64}$/i;

/**
 * Extracts the `session_id` claim from a Supabase access token (a JWT
 * signed by GoTrue). Not independently signature-verified here -- this
 * is only ever called with the access token belonging to the session
 * supabase.auth.getUser() just round-tripped to Supabase's own server to
 * validate, so decoding its payload locally is safe; we are reading a
 * claim out of a token whose authenticity was already confirmed over the
 * network, not trusting an unverified token on its own.
 */
function decodeSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const claims = JSON.parse(json) as { session_id?: unknown };
    const sessionId = claims.session_id;
    if (typeof sessionId === "string" && SESSION_ID_PATTERN.test(sessionId)) {
      return sessionId;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns true only when this call is the one that genuinely claimed
 * "first successful authentication" for this account -- i.e. the signup
 * email pair was (attempted to be) sent. The caller uses this to skip a
 * redundant "welcome back" login email for the very same event.
 */
async function notifySignupIfFirstTime(
  supabase: SupabaseClient,
  user: User,
  appUrl: string
): Promise<boolean> {
  const name = getDisplayName(user);
  const provider = getProviderLabel(user);
  const now = new Date();

  // Atomic claim: only the caller whose UPDATE actually flips this
  // column from null wins the right to send the one-time signup email
  // pair. Postgres serializes concurrent UPDATEs on the same row, so a
  // second, near-simultaneous caller re-checks the WHERE clause after
  // the first commits and legitimately finds no row left to update.
  const { data: claimed, error } = await supabase
    .from("profiles")
    .update({ welcome_email_sent_at: now.toISOString() })
    .eq("id", user.id)
    .is("welcome_email_sent_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[auth-notify] signup dedup check failed:", error.message);
    return false;
  }
  if (!claimed || !user.email) return Boolean(claimed);

  const results = await Promise.allSettled([
    sendCustomerWelcomeEmail({ to: user.email, name, appUrl }),
    sendOwnerAlertEmail({
      subject: "NXTIAI — New Customer Signup",
      text: [
        "New customer:",
        "",
        `Name: ${name ?? "(not provided)"}`,
        `Email: ${user.email}`,
        `Provider: ${provider}`,
        `Created: ${now.toISOString()}`,
        `User ID: ${user.id}`,
      ].join("\n"),
    }),
  ]);

  const [welcomeResult, alertResult] = results;
  if (welcomeResult.status === "fulfilled" && welcomeResult.value.ok) {
    console.log(`[auth-notify] CUSTOMER_WELCOME_EMAIL_SENT user=${user.id}`);
  } else {
    console.error(`[auth-notify] CUSTOMER_WELCOME_EMAIL_FAILED user=${user.id}`);
  }
  if (alertResult.status === "fulfilled" && alertResult.value.ok) {
    console.log(`[auth-notify] SIGNUP_NOTIFICATION_SENT user=${user.id}`);
  } else {
    console.error(`[auth-notify] SIGNUP_NOTIFICATION_FAILED user=${user.id}`);
  }

  return true;
}

async function notifyLoginIfNewSession(
  supabase: SupabaseClient,
  user: User,
  appUrl: string,
  options: { skipEmails: boolean }
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const sessionId = accessToken ? decodeSessionId(accessToken) : null;

  // Can't safely dedupe without a session id -- skip rather than risk
  // sending a login email on every reload/refresh with no gate at all.
  if (!sessionId) return;

  const name = getDisplayName(user);
  const provider = getProviderLabel(user);
  const now = new Date();

  // Same atomic-claim pattern as the signup check above, keyed on the
  // session id instead of a one-time flag: matches only when this
  // session hasn't already been notified (column is null, or holds a
  // different, older session id), so a token refresh or a duplicate
  // SIGNED_IN event for the same session never re-sends mail. Run even
  // when options.skipEmails is true (a first-time signup, which already
  // got its own welcome email) so this session id is recorded and a
  // later, separate SIGNED_IN replay for it doesn't fall through and
  // send a login email after all.
  const { data: claimed, error } = await supabase
    .from("profiles")
    .update({ last_login_notified_session_id: sessionId })
    .eq("id", user.id)
    .or(`last_login_notified_session_id.is.null,last_login_notified_session_id.neq.${sessionId}`)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[auth-notify] login dedup check failed:", error.message);
    return;
  }
  if (!claimed || !user.email || options.skipEmails) return;

  const results = await Promise.allSettled([
    sendCustomerLoginEmail({ to: user.email, name, appUrl }),
    sendOwnerAlertEmail({
      subject: "NXTIAI — Customer Login",
      text: [
        `Customer: ${name ?? "(not provided)"}`,
        `Email: ${user.email}`,
        `Provider: ${provider}`,
        `Time: ${now.toISOString()}`,
        `User ID: ${user.id}`,
      ].join("\n"),
    }),
  ]);

  const [loginEmailResult, alertResult] = results;
  if (loginEmailResult.status === "fulfilled" && loginEmailResult.value.ok) {
    console.log(`[auth-notify] CUSTOMER_LOGIN_EMAIL_SENT user=${user.id}`);
  } else {
    console.error(`[auth-notify] CUSTOMER_LOGIN_EMAIL_FAILED user=${user.id}`);
  }
  if (alertResult.status === "fulfilled" && alertResult.value.ok) {
    console.log(`[auth-notify] LOGIN_NOTIFICATION_SENT user=${user.id}`);
  } else {
    console.error(`[auth-notify] LOGIN_NOTIFICATION_FAILED user=${user.id}`);
  }
}

/**
 * Entry point for both call sites. Best-effort by design end to end --
 * every failure inside is caught and logged, never thrown, so a broken
 * email provider or an unexpected dedup-query error can never fail the
 * authentication request that triggered this.
 */
export async function notifyAuthEvent(supabase: SupabaseClient, user: User, appUrl: string): Promise<void> {
  let isFirstSignup = false;

  try {
    isFirstSignup = await notifySignupIfFirstTime(supabase, user, appUrl);
  } catch (error) {
    console.error("[auth-notify] signup notification threw:", error instanceof Error ? error.message : error);
  }

  try {
    // A first-time signup already sent its own welcome email -- a
    // "welcome back" login email for that exact same event would just
    // be noise, so skip sending (but still record the session id; see
    // notifyLoginIfNewSession's comment on why).
    await notifyLoginIfNewSession(supabase, user, appUrl, { skipEmails: isFirstSignup });
  } catch (error) {
    console.error("[auth-notify] login notification threw:", error instanceof Error ? error.message : error);
  }
}
