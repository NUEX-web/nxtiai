"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, X } from "lucide-react";

const MESSAGES: Record<string, string> = {
  could_not_authenticate:
    "We couldn't complete that sign-in. This usually means the redirect URL isn't allowlisted in Supabase yet, or the sign-in link expired — please try again.",
};

// No real subscription exists for this value — the ?auth_error= param is
// only ever set by a full-page redirect (app/auth/callback/route.ts), which
// remounts the app rather than mutating history in place. useSyncExternalStore
// is used here purely for its other job: giving us a hydration-safe way to
// read a browser-only value (the URL) without a render/setState mismatch
// between the server-rendered HTML and the first client render.
function subscribe() {
  return () => {};
}

function getSnapshot(): string | null {
  return new URLSearchParams(window.location.search).get("auth_error");
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Surfaces the ?auth_error=... query param that app/auth/callback/route.ts
 * redirects with on a failed OAuth/code exchange. Without this, that
 * failure was silent — the user just landed back on the homepage with no
 * explanation.
 */
export default function AuthErrorBanner() {
  const errorCode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);

  // Side effect only — synchronizes the URL (an external system) once the
  // error has been read, so a refresh doesn't keep re-showing the same
  // banner. This never calls setState itself.
  useEffect(() => {
    if (!errorCode) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("auth_error");
    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", newUrl);
  }, [errorCode]);

  if (!errorCode || dismissed) return null;

  const message = MESSAGES[errorCode] ?? "Something went wrong signing you in. Please try again.";

  return (
    <div className="border-b border-danger/20 bg-danger-soft px-6 py-3">
      <div className="mx-auto flex max-w-6xl items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <p className="flex-1 text-sm text-danger">{message}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded-full p-0.5 text-danger transition-colors hover:bg-danger/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
