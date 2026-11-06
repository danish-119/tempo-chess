"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Settings, X } from "lucide-react";
import { NAV } from "@/lib/site";
import { useSettings } from "@/components/providers/SettingsProvider";
import { cx } from "@/components/ui/primitives";
import { Logo } from "./Logo";
import { InstallButton } from "./PwaRegister";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { openSettings } = useSettings();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (routes: readonly string[]) => routes.some((r) => pathname === r || pathname?.startsWith(`${r}/`));

  return (
    <header className={cx("no-print sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75", pathname === "/" && "land-dark")}>
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[auto_1fr] items-center gap-4 px-4 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink" aria-label="Tempo home">
          <Logo className="size-8" />
          <span className="font-serif text-xl tracking-tight">Tempo</span>
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-0.5 rounded-full border border-border bg-surface/60 p-1">
            {NAV.map((item) => (
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
        <div className="ml-auto flex items-center gap-1">
          <InstallButton />
          {pathname !== "/play" ? (
            <Link href="/play" className="pill pill-solid mr-1 !hidden !h-9 md:!inline-flex">
              Play now
            </Link>
          ) : null}
          <button
            type="button"
            aria-label="Settings"
            aria-haspopup="dialog"
            onClick={openSettings}
            className="inline-flex size-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Settings className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-border bg-bg md:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col px-2 py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.match) ? "page" : undefined}
                  className={cx(
                    "block rounded-xl px-3 py-2.5 text-base font-medium",
                    isActive(item.match) ? "bg-accent-soft text-ink" : "text-ink-2",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
