"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { SITE } from "@/lib/site";

/** Brand marks (lucide has none); 24px paths. */
const ICONS: Record<string, string> = {
  GitHub:
    "M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z",
  LinkedIn:
    "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z",
};

/** Full-screen app views have no footer so they fit in one viewport. */
const APP_ROUTES = ["/analyze", "/play", "/practice"];

export function SiteFooter() {
  const pathname = usePathname();
  if (APP_ROUTES.some((r) => pathname === r || pathname?.startsWith(`${r}/`))) return null;
  return (
    <footer className={cx("no-print border-t border-border", pathname === "/" ? "land-dark" : "mt-16")}>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-ink-2 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="font-serif text-base text-ink">Tempo</p>
          <p className="max-w-sm">Free and open source. Analysis by Stockfish, running in your browser.</p>
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
        </nav>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 text-sm text-ink-2">
        <p>
          Made by{" "}
          <a href={SITE.author.url} className="font-medium text-ink underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">
            {SITE.author.name}
          </a>
        </p>
        <ul className="flex items-center gap-1.5" aria-label="Find the author online">
          {SITE.social.map((p) => (
            <li key={p.label}>
              <a
                href={p.url}
                rel="noopener noreferrer"
                target="_blank"
                aria-label={p.label}
                title={p.label}
                className="inline-flex size-8 items-center justify-center rounded-full border border-border text-ink-2 transition-colors hover:border-ink hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                  <path d={ICONS[p.label]} />
                </svg>
              </a>
            </li>
          ))}
          {SITE.contactEmail ? (
            <li>
              <a
                href={`mailto:${SITE.contactEmail}`}
                aria-label="Email"
                title={SITE.contactEmail}
                className="inline-flex size-8 items-center justify-center rounded-full border border-border text-ink-2 transition-colors hover:border-ink hover:text-ink"
              >
                <Mail className="size-4" aria-hidden />
              </a>
            </li>
          ) : null}
        </ul>
      </div>
    </footer>
  );
}
