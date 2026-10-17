/**
 * Update query parameters in place (no navigation, no new history entry), so
 * the address always reflects what is on screen and Back / reload restore it.
 * `null` removes a parameter.
 */
export function setQuery(params: Record<string, string | number | null | undefined>): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
}

/** "2026-09" style key for a year/month pair. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
