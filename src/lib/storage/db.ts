import type { ImportedGame } from "@/lib/chess/types";
import { ApiError, api } from "@/lib/api";
import { docsReady, readDoc, resetDocs, retryWhenOnline, writeDoc } from "@/lib/account/docs";
import { accountReady, firstSave } from "@/lib/account/session";
import { type Progress, ProgressSchema, emptyProgress } from "@/lib/progress";
import type { GameReview } from "@/lib/review/types";

/**
 * Saved games, reviews and progress.
 *
 * A signed-in player's data lives in their account on the Tempo server; this module keeps a copy in memory so
 * pages read it instantly, and writes go to the server. This is the same for a Google account and for a guest. A
 * visitor's data is in memory until their first save makes them a guest, and is then uploaded (`uploadMemory`).
 * Nothing is written to the browser's own storage.
 */
export interface CacheEntry {
  url: string;
  data: unknown;
  fetchedAt: number;
}

export interface SavedGame {
  id: string;
  game: ImportedGame;
  savedAt: number;
  updatedAt: number;
  hasReview: boolean;
  /** The side the player had in this game, used for "my colour" statistics. */
  perspective?: "w" | "b";
}

export type StorageErrorCode = "QUOTA" | "UNAVAILABLE" | "CORRUPT" | "UNKNOWN";

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

const memory = {
  games: new Map<string, SavedGame>(),
  reviews: new Map<string, GameReview>(),
  cache: new Map<string, CacheEntry>(),
};
/** Whether the signed-in player's full game list has been fetched into memory. */
let gamesLoaded = false;

/** Forget everything held in memory (on sign-in, sign-out, and in tests). */
export function resetMemory(): void {
  for (const m of Object.values(memory)) m.clear();
  outbox.clear();
  gamesLoaded = false;
}

/** Reset the module (tests only). */
export function __resetStorageForTests(): void {
  resetMemory();
  resetDocs();
}

function wrap(err: unknown): StorageError {
  if (err instanceof StorageError) return err;
  if (err instanceof ApiError) {
    if (err.code === "limit_reached" || err.status === 413) return new StorageError("QUOTA", err.message);
    if (err.code === "offline" || err.status === 401) return new StorageError("UNAVAILABLE", err.message);
  }
  return new StorageError("UNKNOWN", err instanceof Error ? err.message : "Could not save. Please try again.");
}

function isSavedGame(v: unknown): v is SavedGame {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<SavedGame>;
  return typeof s.id === "string" && !!s.game && Array.isArray(s.game.moves) && typeof s.game.originalPgn === "string";
}

const isReview = (r: unknown): r is GameReview => !!r && Array.isArray((r as GameReview).moves) && Array.isArray((r as GameReview).positions);

async function signedIn(): Promise<boolean> {
  return (await accountReady()).status === "user";
}

/**
 * Send a write to the account. Offline (bots and the coach work without a connection), the write waits in an
 * outbox and is sent when the connection returns, so the game is not lost while the tab stays open; the newest
 * write for the same path wins.
 */
const outbox = new Map<string, { method: "PUT" | "DELETE"; body?: unknown }>();
async function send(path: string, method: "PUT" | "DELETE", body?: unknown): Promise<void> {
  try {
    await api(path, { method, body });
    outbox.delete(path);
  } catch (err) {
    if (err instanceof ApiError && err.code === "offline") {
      const first = outbox.size === 0;
      outbox.set(path, { method, body });
      if (first) retryWhenOnline(() => void drainOutbox());
      return;
    }
    throw err;
  }
}

async function drainOutbox(): Promise<void> {
  for (const [path, w] of [...outbox]) {
    try {
      await send(path, w.method, w.body);
    } catch (err) {
      console.warn("Could not save after reconnecting:", err);
      outbox.delete(path);
    }
  }
}

// --- games -----------------------------------------------------------------
export async function saveGame(game: ImportedGame, opts: { perspective?: "w" | "b" } = {}): Promise<SavedGame> {
  const now = Date.now();
  const existing = memory.games.get(game.id) ?? ((await signedIn()) && !gamesLoaded ? await getGame(game.id).catch(() => null) : null);
  const record: SavedGame = {
    id: game.id,
    game,
    savedAt: existing?.savedAt ?? now,
    updatedAt: now,
    hasReview: existing?.hasReview ?? false,
    perspective: opts.perspective ?? existing?.perspective,
  };
  if (await signedIn()) {
    try {
      await send(`/api/v1/games/${encodeURIComponent(record.id)}`, "PUT", { game: record });
    } catch (err) {
      throw wrap(err);
    }
  }
  memory.games.set(record.id, record);
  firstSave();
  return record;
}

export async function getGame(id: string): Promise<SavedGame | null> {
  const cached = memory.games.get(id);
  if (cached) return cached;
  if (!(await signedIn())) return null;
  try {
    const { game } = await api<{ game: unknown }>(`/api/v1/games/${encodeURIComponent(id)}`);
    if (!isSavedGame(game)) throw new StorageError("CORRUPT", "This saved game is damaged and cannot be opened.");
    memory.games.set(game.id, game);
    return game;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw wrap(err);
  }
}

export async function listGames(): Promise<SavedGame[]> {
  if ((await signedIn()) && !gamesLoaded) {
    try {
      const all: SavedGame[] = [];
      let before: number | null = null;
      do {
        const page: { games: unknown[]; next: number | null } = await api(`/api/v1/games?limit=500${before ? `&before=${before}` : ""}`);
        for (const g of page.games) if (isSavedGame(g)) all.push(g);
        before = page.next;
      } while (before);
      for (const g of all) memory.games.set(g.id, g);
      gamesLoaded = true;
    } catch (err) {
      throw wrap(err);
    }
  }
  return [...memory.games.values()].filter(isSavedGame).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteGame(id: string): Promise<void> {
  if (await signedIn()) {
    try {
      await send(`/api/v1/games/${encodeURIComponent(id)}`, "DELETE");
    } catch (err) {
      throw wrap(err);
    }
  }
  memory.games.delete(id);
  memory.reviews.delete(id);
}

// --- reviews ---------------------------------------------------------------
export async function saveReview(review: GameReview): Promise<void> {
  const g = memory.games.get(review.gameId) ?? (await getGame(review.gameId).catch(() => null));
  const updated = g ? { ...g, hasReview: true, updatedAt: Date.now() } : null;
  if (await signedIn()) {
    try {
      await send(`/api/v1/reviews/${encodeURIComponent(review.gameId)}`, "PUT", { review });
      if (updated) await send(`/api/v1/games/${encodeURIComponent(updated.id)}`, "PUT", { game: updated });
    } catch (err) {
      throw wrap(err);
    }
  }
  memory.reviews.set(review.gameId, review);
  if (updated) memory.games.set(updated.id, updated);
  firstSave();
}

/** A visitor has just become a guest: upload the games and reviews they made before that. */
export async function uploadMemory(): Promise<void> {
  for (const g of memory.games.values()) await send(`/api/v1/games/${encodeURIComponent(g.id)}`, "PUT", { game: g }).catch((err) => console.warn("Could not save a game:", err));
  for (const r of memory.reviews.values()) await send(`/api/v1/reviews/${encodeURIComponent(r.gameId)}`, "PUT", { review: r }).catch((err) => console.warn("Could not save a review:", err));
  gamesLoaded = true;
}

export async function getReview(gameId: string): Promise<GameReview | null> {
  const cached = memory.reviews.get(gameId);
  if (cached) return cached;
  if (!(await signedIn())) return null;
  try {
    const { review } = await api<{ review: unknown }>(`/api/v1/reviews/${encodeURIComponent(gameId)}`);
    if (!isReview(review)) return null; // missing or damaged: the review is simply run again
    memory.reviews.set(gameId, review);
    return review;
  } catch (err) {
    throw wrap(err);
  }
}

// --- HTTP cache (public Chess.com responses, for this visit only) -----------
export async function cacheGet(url: string): Promise<CacheEntry | null> {
  return memory.cache.get(url) ?? null;
}

export async function cacheSet(url: string, data: unknown): Promise<void> {
  memory.cache.set(url, { url, data, fetchedAt: Date.now() });
}

// --- progress (streaks, rating estimate, finished lessons) ------------------------
const PROGRESS_EVENT = "tempo:progress";

export async function getProgress(): Promise<Progress> {
  await docsReady();
  const parsed = ProgressSchema.safeParse(readDoc<unknown>("progress", null));
  return parsed.success ? parsed.data : emptyProgress();
}

export async function setProgress(data: Progress): Promise<void> {
  writeDoc("progress", data);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROGRESS_EVENT));
}

/** Serialised read-modify-write, so two quick updates never overwrite each other. */
let progressQueue: Promise<unknown> = Promise.resolve();
export function updateProgress(fn: (p: Progress) => Progress): Promise<Progress> {
  const run = progressQueue.then(async () => {
    const next = fn(await getProgress());
    await setProgress(next);
    return next;
  });
  progressQueue = run.catch(() => undefined);
  return run;
}

export const PROGRESS_CHANGED = PROGRESS_EVENT;

