"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, UserRound } from "lucide-react";
import { useAccount } from "@/components/providers/AccountProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { authClient } from "@/lib/account/auth-client";
import { flushDocs } from "@/lib/account/docs";
import { Avatar } from "./Avatar";

/**
 * The header's account control: "Sign in" for a visitor; for a player (an account or a guest) their picture, with a
 * small menu. A guest's menu invites them to sign in with Google, which keeps their progress for good.
 */
export function AccountButton() {
  const account = useAccount();
  const { openSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (account.status === "loading") return <span className="inline-block size-9 animate-pulse rounded-full bg-surface-2" aria-hidden />;

  if (account.status === "visitor") {
    return (
      <Link href="/account" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2">
        <UserRound className="size-4" aria-hidden /> Sign in
      </Link>
    );
  }

  const p = account.player;
  const name = p.name;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name}`}
        className="inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-surface-2"
      >
        <Avatar name={name} image={p.image} size={32} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow)]">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={name} image={p.image} size={40} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-xs text-ink-3">
                <span className="font-mono">#{p.tag}</span>
                {p.guest ? " · Guest" : null}
              </p>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          {p.guest ? (
            <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className="mb-1 block rounded-lg bg-accent-soft px-2 py-2 text-sm hover:brightness-105">
              <span className="font-semibold">Sign in with Google</span>
              <span className="block text-xs text-ink-2">to keep your progress for good</span>
            </Link>
          ) : null}
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2">
            <UserRound className="size-4" aria-hidden /> {p.guest ? "Your guest profile" : "Your account"}
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              openSettings();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
          >
            <Settings className="size-4" aria-hidden /> Settings
          </button>
          {/* A guest has nothing to sign back in with, so signing out would lose everything: no button for them. */}
          {p.guest ? null : (
            <button
              role="menuitem"
              type="button"
              onClick={async () => {
                setOpen(false);
                await flushDocs();
                await authClient.signOut();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
            >
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
