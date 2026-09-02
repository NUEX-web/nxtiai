import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// RFC 2606 reserved TLD -- guaranteed to never resolve. Used only when
// real config is missing, so construction never throws (see below).
const PLACEHOLDER_URL = "https://placeholder.invalid";
const PLACEHOLDER_KEY = "placeholder-anon-key";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase URL or Anon Key is missing in environment variables.");
  }

  // Same reasoning as lib/supabase/client.ts: createServerClient throws
  // synchronously on an empty/invalid URL, and this function runs during
  // server-side prerendering too (e.g. app/account/page.tsx) -- an
  // uncaught throw here has the same build-failure risk. A placeholder
  // keeps construction safe; real calls against it fail normally and are
  // already handled by every call site.
  return createServerClient(supabaseUrl || PLACEHOLDER_URL, supabaseAnonKey || PLACEHOLDER_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}
