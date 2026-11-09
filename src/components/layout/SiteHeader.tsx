"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartLine, Puzzle, Settings, Swords, Trophy } from "lucide-react";
import { NAV } from "@/lib/site";
import { useSettings } from "@/components/providers/SettingsProvider";
import { cx } from "@/components/ui/primitives";
import { AccountButton } from "@/components/account/AccountButton";
import { useAccount } from "@/components/providers/AccountProvider";
import { Logo } from "./Logo";
import { InstallButton } from "./PwaRegister";

const NAV_ICONS = {
  "/play": Swords,
  "/review": ChartLine,
  "/practice": Puzzle,
  "/learn": BookOpen,
  "/progress": Trophy,
} as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { openSettings } = useSettings();
  const account = useAccount();
  // Progress is for players (an account or a guest); a visitor has nothing saved to show there.
  const nav = account.status === "user" ? NAV : NAV.filter((item) => item.href !== "/progress");

  const isActive = (routes: readonly string[]) => routes.some((r) => pathname === r || pathname?.startsWith(`${r}/`));

  return (
    <>
      <header className={cx("no-print sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75", pathname === "/" && "land-dark")}>
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[auto_1fr] items-center gap-4 px-4 md:grid-cols-[1fr_auto_1fr]">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink" aria-label="Tempo home">
            <Logo className="size-8" />
            <span className="font-serif text-xl tracking-tight">Tempo</span>
          </Link>
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-0.5 rounded-full border border-border bg-surface/60 p-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.match) ? "page" : undefined}
                    className={cx(
                      "block rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                      isActive(item.match) ? "bg-accent text-accent-ink shadow-sm" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <InstallButton />
            <AccountButton />
            {/* A player (account or guest) finds Settings in the avatar menu; a visitor gets it as its own round button. */}
            {account.status !== "user" ? (
              <button
                type="button"
                aria-label="Settings"
                aria-haspopup="dialog"
                onClick={openSettings}
                className="inline-flex size-9 items-center justify-center rounded-full border border-border text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Settings className="size-[18px]" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Phones: the sections live in a bar of icons along the bottom edge, reachable with a thumb. */}
      <nav
        aria-label="Mobile"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_rgba(0,0,0,0.28)] md:hidden"
      >
        <ul className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((item) => {
            const Icon = NAV_ICONS[item.href];
            const active = isActive(item.match);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1.5 text-[10px] font-semibold transition-colors min-[360px]:text-[11px] min-[400px]:text-xs",
                    active ? "text-accent" : "text-ink-2 active:text-ink",
                  )}
                >
                  {active ? <span className="absolute top-0 h-[3px] w-10 rounded-b-full bg-accent" aria-hidden /> : null}
                  <Icon className="size-[26px]" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  <span className="max-w-full truncate px-0.5">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
