"use client";

import { useState } from "react";
import { appUrl, authClient } from "@/lib/account/auth-client";

/**
 * "Continue with Google": the only way to sign in. `callback` is where Google sends the player back to; `before`
 * runs first (to hold a visitor's unsaved progress on the server while they are away).
 */
export function GoogleButton({ callback, label = "Continue with Google", before }: { callback: string; label?: string; before?: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await before?.();
          } catch {
            setError("Google sign-in is not available right now. Please try again.");
            setBusy(false);
            return;
          }
          const { error: e } = await authClient.signIn.social({ provider: "google", callbackURL: callback, errorCallbackURL: appUrl("/account") });
          if (e) {
            setError(e.status === 429 ? "Too many tries. Please wait a minute and try again." : "Google sign-in is not available right now. Please try again.");
            setBusy(false);
          }
        }}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-bg text-sm font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
        </svg>
        {label}
      </button>
      {error ? <p className="mt-2 text-xs font-medium text-bad">{error}</p> : null}
    </>
  );
}
