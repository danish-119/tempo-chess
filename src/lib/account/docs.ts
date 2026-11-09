import { ApiError, api } from "@/lib/api";
import { accountReady, currentPlayer, firstSave } from "./session";

/**
 * The player's small saved records: settings, progress, lesson progress and so on.
 *
 * They are read from memory, so the app never waits for them. For a signed-in player they are loaded from the
 * account once after sign-in, and every change is saved to the account shortly after it is made. Each save names
 * the version it was based on; if another device saved in the meantime, the server says so and the newer copy is
 * taken as the base before this change is saved again on top of it. A visitor's first change makes them a guest
 * (see guest.ts), and from then on their records are saved the same way.
 */
export const DOC_KEYS = ["settings", "progress", "basics", "play", "shortcuts", "rush"] as const;
export type DocKey = (typeof DOC_KEYS)[number];

interface Entry {
  data: unknown;
  version: number;
}

const entries = new Map<DocKey, Entry>();
const listeners = new Set<() => void>();
const pending = new Map<DocKey, ReturnType<typeof setTimeout>>();
const inflight = new Map<DocKey, Promise<void>>();
let loaded = false;
let loadedListeners: (() => void)[] = [];
const SAVE_DELAY = 400;

function emit() {
  for (const l of listeners) l();
}

/** The current value, or `fallback` when nothing has been saved yet. */
export function readDoc<T>(key: DocKey, fallback: T): T {
  const e = entries.get(key);
  return e === undefined || e.data === null ? fallback : (e.data as T);
}

/** Change a record: memory is updated at once, and the server a moment later. */
export function writeDoc<T>(key: DocKey, data: T): void {
  const version = entries.get(key)?.version ?? 0;
  entries.set(key, { data, version });
  emit();
  if (!currentPlayer()) return firstSave();
  const t = pending.get(key);
  if (t) clearTimeout(t);
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      void flush(key);
    }, SAVE_DELAY),
  );
}

async function flush(key: DocKey, attempt = 0): Promise<void> {
  const before = inflight.get(key);
  if (before) await before.catch(() => undefined);
  const entry = entries.get(key);
  if (!entry || !currentPlayer()) return;
  const run = (async () => {
    try {
      const res = await api<{ version: number }>(`/api/v1/docs/${key}`, { method: "PUT", body: { data: entry.data, baseVersion: entry.version } });
      const now = entries.get(key);
      // Keep any newer local change; only the version moves forward.
      entries.set(key, { data: now?.data ?? entry.data, version: res.version });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && attempt < 3) {
        const current = (err.body as { current?: { version: number } | null })?.current;
        const now = entries.get(key);
        entries.set(key, { data: now?.data ?? entry.data, version: current?.version ?? 0 });
        inflight.delete(key);
        await flush(key, attempt + 1);
        return;
      }
      if (err instanceof ApiError && err.code === "offline") {
        // Playing offline (bots and the coach work without a connection): save as soon as it comes back.
        retryWhenOnline(() => void flush(key));
        return;
      }
      console.warn(`Could not save ${key}:`, err);
    }
  })();
  inflight.set(key, run);
  await run;
  if (inflight.get(key) === run) inflight.delete(key);
}

const waitingForNetwork = new Set<() => void>();

/** Run `fn` once the browser is back online (each waiting job runs once). */
export function retryWhenOnline(fn: () => void): void {
  if (typeof window === "undefined") return;
  if (waitingForNetwork.size === 0) {
    window.addEventListener(
      "online",
      () => {
        const jobs = [...waitingForNetwork];
        waitingForNetwork.clear();
        for (const j of jobs) j();
      },
      { once: true },
    );
  }
  waitingForNetwork.add(fn);
}

/** Save everything that is waiting, e.g. before signing out. */
export async function flushDocs(): Promise<void> {
  const keys = [...pending.keys()];
  for (const k of keys) {
    clearTimeout(pending.get(k));
    pending.delete(k);
  }
  await Promise.all([...keys.map((k) => flush(k)), ...inflight.values()]);
}

/** A visitor has just become a guest: save everything they changed before that. */
export async function adoptDocs(): Promise<void> {
  await Promise.all([...entries.keys()].map((k) => flush(k)));
}

/** After sign-in: take the account's copies. */
export async function loadDocs(): Promise<void> {
  const { docs } = await api<{ docs: { key: DocKey; data: unknown; version: number }[] }>("/api/v1/docs");
  entries.clear();
  for (const d of docs) if ((DOC_KEYS as readonly string[]).includes(d.key)) entries.set(d.key, { data: d.data, version: d.version });
  markLoaded();
}

/** For a visitor, or after signing out: start empty. */
export function resetDocs(): void {
  for (const t of pending.values()) clearTimeout(t);
  pending.clear();
  entries.clear();
  markLoaded();
}

function markLoaded() {
  loaded = true;
  const ls = loadedListeners;
  loadedListeners = [];
  for (const l of ls) l();
  emit();
}

/** Resolves once the records are ready to read (the account has been checked, and loaded if signed in). */
export async function docsReady(): Promise<void> {
  await accountReady();
  if (loaded) return;
  await new Promise<void>((resolve) => loadedListeners.push(resolve));
}

export function subscribeDocs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests only. */
export function __resetDocsForTests(): void {
  resetDocs();
  loaded = false;
}
