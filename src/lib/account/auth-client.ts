import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { API_URL } from "@/lib/api";

/**
 * Better Auth tells other open tabs about sign-in and sign-out by writing to localStorage. Tempo keeps nothing in
 * browser storage, so it gets the same signal through the browser's BroadcastChannel instead, which stores nothing.
 * This must be installed before the client is created; the client looks it up under this well-known symbol.
 */
type Message = { event?: string; data?: unknown; timestamp?: number };
const CHANNEL_KEY = Symbol.for("better-auth:broadcast-channel");
if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" && !(globalThis as Record<symbol, unknown>)[CHANNEL_KEY]) {
  const listeners = new Set<(m: Message) => void>();
  const channel = new BroadcastChannel("tempo-auth");
  (globalThis as Record<symbol, unknown>)[CHANNEL_KEY] = {
    subscribe(listener: (m: Message) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    post(message: Message) {
      channel.postMessage({ ...message, timestamp: Math.floor(Date.now() / 1000) });
    },
    setup() {
      const onMessage = (e: MessageEvent<Message>) => {
        if (e.data?.event !== "session" || !e.data.data) return;
        for (const l of listeners) l(e.data);
      };
      channel.addEventListener("message", onMessage);
      return () => channel.removeEventListener("message", onMessage);
    },
  };
}

/** Sign-in with Google, guest sessions, and the account itself, talking to the Tempo API. */
export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [anonymousClient()],
});

/** A full address on this site, for where Google sends the player back to. */
export const appUrl = (path: string) => (typeof window === "undefined" ? path : new URL(path, window.location.origin).toString());
