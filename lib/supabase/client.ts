import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    // Graceful fallback for dev when Supabase env keys are not yet provided
    console.warn("Supabase URL or Anon Key is missing in environment variables.");
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
