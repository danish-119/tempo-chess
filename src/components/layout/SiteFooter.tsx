"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";

/** Full-screen app views have no footer so they fit in one viewport. */
const APP_ROUTES = ["/analyze", "/play", "/practice"];

export function SiteFooter() {
  const pathname = usePathname();
  if (APP_ROUTES.some((r) => pathname === r || pathname?.startsWith(`${r}/`))) return null;
  return (
    <footer className="no-print mt-16 border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-ink-2 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="font-serif text-base text-ink">Tempo</p>
          <p className="max-w-sm">Free and open source. Analysis by Stockfish, running in your browser.</p>
          <p>
            Made by{" "}
            <a href={SITE.author.url} className="font-medium text-ink underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">
              {SITE.author.name}
            </a>
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end">
          <Link href="/about" className="hover:text-ink">About &amp; licenses</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          {SITE.repoUrl ? (
            <a href={SITE.repoUrl} className="hover:text-ink" rel="noopener noreferrer" target="_blank">
              Source code
            </a>
          ) : (
            <Link href="/about#source" className="hover:text-ink">Source code</Link>
          )}
          {SITE.contactEmail ? (
            <a href={`mailto:${SITE.contactEmail}`} className="hover:text-ink">Support</a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
