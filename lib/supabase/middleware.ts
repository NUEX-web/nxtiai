import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Same validation as lib/supabase/client.ts and lib/supabase/server.ts:
// @supabase/supabase-js throws synchronously with "Invalid supabaseUrl:
// Must be a valid HTTP or HTTPS URL." for a non-empty value that isn't a
// well-formed http(s) URL. This file previously only checked truthiness
// (`if (!supabaseUrl ...)`), so a malformed-but-non-empty value would
// reach createServerClient() unvalidated and crash every request that
// goes through the proxy/middleware. Bail out the same way the other
// two files do: skip session refresh rather than throw.
function isValidSupabaseUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return false;
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey || !isValidSupabaseUrl(supabaseUrl)) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh auth session if needed
  await supabase.auth.getUser();

  return supabaseResponse;
}
