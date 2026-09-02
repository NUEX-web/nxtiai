import { createBrowserClient } from "@supabase/ssr";

// RFC 2606 reserved TLD -- guaranteed to never resolve. Used only when
// real config is missing, so construction never throws (see below).
const PLACEHOLDER_URL = "https://placeholder.invalid";
const PLACEHOLDER_KEY = "placeholder-anon-key";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    // Graceful fallback for dev when Supabase env keys are not yet provided
    console.warn("Supabase URL or Anon Key is missing in environment variables.");
  }

  // createBrowserClient throws synchronously on an empty/invalid URL. In
  // the browser that's an acceptable loud failure, but this function is
  // also called from the render body of client components (AuthProvider,
  // AuthModal, the reset-password page) that Next.js prerenders on the
  // server during `next build` -- an uncaught throw there doesn't fail
  // gracefully, it aborts that page's prerender and can fail the whole
  // build. Falling back to a syntactically valid, unreachable placeholder
  // keeps construction itself safe in both contexts; any real auth call
  // made against it simply fails with a normal network/auth error, which
  // every call site already handles.
  return createBrowserClient(supabaseUrl || PLACEHOLDER_URL, supabaseAnonKey || PLACEHOLDER_KEY);
}
