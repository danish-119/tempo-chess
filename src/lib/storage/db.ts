import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { ImportedGame } from "@/lib/chess/types";
import type { GameReview } from "@/lib/review/types";

/**
 * Local persistence (IndexedDB). Nothing here ever leaves the browser.
 * If IndexedDB is unavailable (private mode in some browsers, blocked
 * storage), an in-memory fallback keeps the app usable for the session and
 * `storageStatus()` reports that data will not persist.
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
  /** Username the user identifies as, used for "my colour" statistics. */
  perspective?: "w" | "b";
}

interface TempoDB extends DBSchema {
  games: { key: string; value: SavedGame; indexes: { updatedAt: number } };
  reviews: { key: string; value: GameReview };
  cache: { key: string; value: CacheEntry };
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

const DB_NAME = "tempo";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TempoDB> | null> | null = null;
const memory = {
  games: new Map<string, SavedGame>(),
  reviews: new Map<string, GameReview>(),
  cache: new Map<string, CacheEntry>(),
};

function getDb(): Promise<IDBPDatabase<TempoDB> | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = openDB<TempoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const games = db.createObjectStore("games", { keyPath: "id" });
      games.createIndex("updatedAt", "updatedAt");
      db.createObjectStore("reviews", { keyPath: "gameId" });
      db.createObjectStore("cache", { keyPath: "url" });
    },
  }).catch(() => null);
  return dbPromise;
}

export async function storageStatus(): Promise<"persistent" | "memory"> {
  return (await getDb()) ? "persistent" : "memory";
}

/** Reset the module (tests only). */
export function __resetStorageForTests(): void {
  dbPromise = null;
  for (const m of Object.values(memory)) m.clear();
}

function wrap(err: unknown): StorageError {
  if (err instanceof StorageError) return err;
  const name = err instanceof DOMException ? err.name : "";
  if (name === "QuotaExceededError") {
    return new StorageError("QUOTA", "Your browser's storage is full. Delete some saved games and try again.");
  }
  if (name === "InvalidStateError" || name === "SecurityError") {
    return new StorageError("UNAVAILABLE", "Browser storage is not available (private browsing or blocked site data).");
  }
  return new StorageError("UNKNOWN", err instanceof Error ? err.message : "Unexpected storage error.");
}

function isSavedGame(v: unknown): v is SavedGame {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<SavedGame>;
  return typeof s.id === "string" && !!s.game && Array.isArray(s.game.moves) && typeof s.game.originalPgn === "string";
}

// --- games -----------------------------------------------------------------
export async function saveGame(game: ImportedGame, opts: { perspective?: "w" | "b" } = {}): Promise<SavedGame> {
  const now = Date.now();
  try {
    const db = await getDb();
    const existing = db ? await db.get("games", game.id) : memory.games.get(game.id);
    const record: SavedGame = {
      id: game.id,
      game,
      savedAt: existing?.savedAt ?? now,
      updatedAt: now,
      hasReview: existing?.hasReview ?? false,
      perspective: opts.perspective ?? existing?.perspective,
    };
    if (db) await db.put("games", record);
    else memory.games.set(record.id, record);
    return record;
  } catch (err) {
    throw wrap(err);
  }
}

export async function getGame(id: string): Promise<SavedGame | null> {
  try {
    const db = await getDb();
    const value = db ? await db.get("games", id) : memory.games.get(id);
    if (value === undefined) return null;
    if (!isSavedGame(value)) throw new StorageError("CORRUPT", "This saved game is damaged and cannot be opened.");
    return value;
  } catch (err) {
    throw wrap(err);
  }
}

export async function listGames(): Promise<SavedGame[]> {
  try {
    const db = await getDb();
    const all = db ? await db.getAllFromIndex("games", "updatedAt") : [...memory.games.values()];
    return all.filter(isSavedGame).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    throw wrap(err);
  }
}

export async function deleteGame(id: string): Promise<void> {
  try {
    const db = await getDb();
    if (db) {
      const tx = db.transaction(["games", "reviews"], "readwrite");
      await tx.objectStore("games").delete(id);
      await tx.objectStore("reviews").delete(id);
      await tx.done;
    } else {
      memory.games.delete(id);
      memory.reviews.delete(id);
    }
  } catch (err) {
    throw wrap(err);
  }
}

export async function clearAll(): Promise<void> {
  try {
    const db = await getDb();
    if (db) {
      const tx = db.transaction(["games", "reviews", "cache"], "readwrite");
      await Promise.all([
        tx.objectStore("games").clear(),
        tx.objectStore("reviews").clear(),
        tx.objectStore("cache").clear(),
        tx.done,
      ]);
    } else {
      for (const m of Object.values(memory)) m.clear();
    }
  } catch (err) {
    throw wrap(err);
  }
}

// --- reviews ---------------------------------------------------------------
export async function saveReview(review: GameReview): Promise<void> {
  try {
    const db = await getDb();
    if (db) {
      const tx = db.transaction(["reviews", "games"], "readwrite");
      await tx.objectStore("reviews").put(review);
      const g = await tx.objectStore("games").get(review.gameId);
      if (g) await tx.objectStore("games").put({ ...g, hasReview: true, updatedAt: Date.now() });
      await tx.done;
    } else {
      memory.reviews.set(review.gameId, review);
      const g = memory.games.get(review.gameId);
      if (g) memory.games.set(g.id, { ...g, hasReview: true, updatedAt: Date.now() });
    }
  } catch (err) {
    throw wrap(err);
  }
}

export async function getReview(gameId: string): Promise<GameReview | null> {
  try {
    const db = await getDb();
    const r = db ? await db.get("reviews", gameId) : memory.reviews.get(gameId);
    if (!r) return null;
    if (!Array.isArray(r.moves) || !Array.isArray(r.positions)) return null; // corrupt: re-run review
    return r;
  } catch (err) {
    throw wrap(err);
  }
}

export async function listReviews(): Promise<GameReview[]> {
  try {
    const db = await getDb();
    const all = db ? await db.getAll("reviews") : [...memory.reviews.values()];
    return all.filter((r) => r && Array.isArray(r.moves) && Array.isArray(r.positions));
  } catch (err) {
    throw wrap(err);
  }
}

// --- HTTP cache (public Chess.com responses only) --------------------------
export async function cacheGet(url: string): Promise<CacheEntry | null> {
  try {
    const db = await getDb();
    return (db ? await db.get("cache", url) : memory.cache.get(url)) ?? null;
  } catch {
    return null; // cache failures must never break imports
  }
}

export async function cacheSet(url: string, data: unknown): Promise<void> {
  const entry: CacheEntry = { url, data, fetchedAt: Date.now() };
  try {
    const db = await getDb();
    if (db) await db.put("cache", entry);
    else memory.cache.set(url, entry);
  } catch {
    memory.cache.set(url, entry);
  }
}
