"use client";

import { Download, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Registers the service worker (production only) so Tempo works offline. */
export function PwaRegister() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="no-print fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-lg"
    >
      <WifiOff className="size-3.5" aria-hidden /> Offline: everything except importing games still works
    </div>
  );
}

/** "Install app" button, shown only when the browser offers installation. */
export function InstallButton() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!event) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await event.prompt();
        await event.userChoice.catch(() => undefined);
        setEvent(null);
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <Download className="size-4" aria-hidden /> <span className="hidden sm:inline">Install app</span>
      <span className="sr-only sm:hidden">Install app</span>
    </button>
  );
}
