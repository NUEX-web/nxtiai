import { createBrowserClient } from "@supabase/ssr";

// RFC 2606 reserved TLD -- guaranteed to never resolve. Used only when
// real config is missing or malformed, so construction never throws
// (see resolveSupabaseUrl below).
const PLACEHOLDER_URL = "https://placeholder.invalid";
const PLACEHOLDER_KEY = "placeholder-anon-key";

// @supabase/supabase-js validates the URL it's given with exactly this
// rule internally: a non-empty value that doesn't start with "http://"
// or "https://" (case-insensitive), or that `new URL()` can't parse,
// throws synchronously with "Invalid supabaseUrl: Must be a valid HTTP
// or HTTPS URL." A plain `supabaseUrl || PLACEHOLDER_URL` fallback only
// replaces an EMPTY string -- a non-empty but malformed value (missing
// the scheme, stray whitespace/quotes from how it was pasted into the
// hosting provider, etc.) is truthy and sails straight through
// unmodified, so it still crashes construction. Validate the actual
// format, not just truthiness, so any malformed value -- not only a
// missing one -- safely falls back to the placeholder.
function resolveSupabaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    if (trimmed) {
      console.warn(
        `NEXT_PUBLIC_SUPABASE_URL is set but is not a valid http(s) URL ("${trimmed}"). Falling back to a placeholder; check this value in your hosting provider's environment variables.`
      );
    }
    return PLACEHOLDER_URL;
  }
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    console.warn(
      `NEXT_PUBLIC_SUPABASE_URL is set but could not be parsed as a URL ("${trimmed}"). Falling back to a placeholder; check this value in your hosting provider's environment variables.`
    );
    return PLACEHOLDER_URL;
  }
}

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
  // build. Resolving to a syntactically valid, unreachable placeholder
  // whenever the real value is missing OR malformed keeps construction
  // itself safe in both contexts; any real auth call made against it
  // simply fails with a normal network/auth error, which every call
  // site already handles.
  return createBrowserClient(resolveSupabaseUrl(supabaseUrl), supabaseAnonKey || PLACEHOLDER_KEY);
}
