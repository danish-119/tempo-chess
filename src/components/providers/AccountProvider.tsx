"use client";

import { useEffect, useSyncExternalStore } from "react";
import { authClient } from "@/lib/account/auth-client";
import { loadDocs, resetDocs } from "@/lib/account/docs";
import "@/lib/account/guest"; // a visitor's first save makes them a guest
import { type AccountState, type Player, getAccount, setAccount, subscribeAccount } from "@/lib/account/session";
import { ApiError, api } from "@/lib/api";
import { resetMemory } from "@/lib/storage/db";

/**
 * Finds out who is here, and keeps the rest of the app in step. A player with a session (a Google account or a
 * guest) has their saved data loaded from the server; a visitor starts empty. After sign-out everything held in
 * memory is dropped.
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (isPending) return;
    // A session this tab has just started (a visitor becoming a guest) is already set up, with their data in memory.
    const now = getAccount();
    if (userId && now.status === "user" && now.player.id === userId) return;
    let alive = true;
    void (async () => {
      if (!userId) {
        resetMemory();
        resetDocs();
        if (alive) setAccount({ status: "visitor" });
        return;
      }
      try {
        const player = await api<Player>("/api/v1/me");
        resetMemory();
        await loadDocs();
        if (alive) {
          setAccount({ status: "user", player });
        }
      } catch (err) {
        // Offline right at start-up: carry on as a visitor for now rather than blocking the app.
        console.warn("Could not load the account:", err instanceof ApiError ? err.message : err);
        resetMemory();
        resetDocs();
        if (alive) setAccount({ status: "visitor" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [isPending, userId]);

  return <>{children}</>;
}

/** The account as React state. */
const LOADING: AccountState = { status: "loading" };
export function useAccount(): AccountState {
  return useSyncExternalStore(subscribeAccount, getAccount, () => LOADING);
}

/** Refresh the player (after a name or picture change). */
export async function refreshPlayer(): Promise<void> {
  const player = await api<Player>("/api/v1/me");
  setAccount({ status: "user", player });
}
