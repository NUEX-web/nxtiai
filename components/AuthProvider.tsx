"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import AuthModal from "./AuthModal";
import type { PlanId } from "@/lib/server/plans";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan_tier: PlanId;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Opens the single, app-wide sign-in/sign-up modal. Any component
   * (nav, hero, pricing) can trigger it through this instead of each
   * owning its own modal instance and open state. */
  openAuthModal: (mode?: "login" | "signup") => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  openAuthModal: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Lazy useState initializer — createClient() runs exactly once, on the
  // first render, and never during a render after that (unlike reading
  // ref.current in the render body, which React's rules disallow). Gives
  // a stable reference the effect below can honestly depend on.
  const [supabase] = useState(() => createClient());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");

  const openAuthModal = useCallback((mode: "login" | "signup" = "login") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (!error && data) {
          setProfile(data as UserProfile);
        }
      } catch {
        // Profile fetch failed or Supabase env not configured
      }
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch {
        // Fallback when Supabase env not configured
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        setLoading(false);

        // Only a genuine new sign-in should trigger login/signup
        // notification emails -- never a page-load session restore
        // (INITIAL_SESSION), a background token refresh
        // (TOKEN_REFRESHED), or a profile edit (USER_UPDATED). This is
        // the only server touchpoint plain email/password login ever
        // has (signInWithPassword() is a direct browser-to-Supabase
        // call), so it's also the only place that can trigger it for
        // that flow. The server independently re-verifies the session
        // and deduplicates by session id (lib/server/auth-notify.ts),
        // so even this firing more than once for one real login --
        // multiple open tabs replaying the same event, a remount --
        // never sends more than one email.
        if (event === "SIGNED_IN" && currentUser) {
          fetch("/api/auth/notify", { method: "POST" }).catch(() => {
            // Best-effort -- a failed notification call must never
            // affect the user's actual sign-in.
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile, openAuthModal }}>
      {children}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
