import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client -- bypasses Row Level Security entirely.
 *
 * This must NEVER be imported from a "use client" file, a page, or any
 * code path that runs in the browser. It exists for exactly one purpose
 * today: the Mollie webhook handler (app/api/payments/webhook/route.ts)
 * needs to write a payment_webhook_events row and a user_subscriptions
 * row on behalf of whichever user the payment's metadata names -- not
 * the caller's own session, since Mollie's server-to-server webhook
 * request carries no Supabase session cookie at all. Every other
 * server-side Supabase access in this codebase should keep using
 * lib/supabase/server.ts's cookie-scoped client, which is bound to (and
 * limited by) the RLS policies for whoever is actually signed in.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is not configured -- check environment variables in your hosting provider."
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
