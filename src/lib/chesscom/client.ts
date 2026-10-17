import { z } from "zod";
import { parseSingleGame } from "@/lib/chess/pgn";
import type { Color, ImportedGame, TimeClass } from "@/lib/chess/types";
import { cacheGet, cacheSet } from "@/lib/storage/db";

/**
 * Client for Chess.com's Published-Data API (public data only).
 * https://www.chess.com/news/view/published-data-api
 *
 * - Requests are strictly serial: Chess.com allows unlimited serial access
 *   but may answer parallel requests with HTTP 429.
 * - Only https://api.chess.com/pub/... URLs are ever requested.
 * - Past monthly archives never change, so they are cached indefinitely;
 *   the archive list and the current month use a short TTL.
 */
export const API_ORIGIN = "https://api.chess.com";
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const SHORT_TTL_MS = 10 * 60 * 1000;

export type ChessComErrorCode = "INVALID_USERNAME" | "NOT_FOUND" | "MONTH_UNAVAILABLE" | "RATE_LIMITED" | "NETWORK" | "TIMEOUT" | "SERVER" | "BAD_RESPONSE" | "INVALID_URL";

export class ChessComError extends Error {
  readonly code: ChessComErrorCode;
  constructor(code: ChessComErrorCode, message: string) {
    super(message);
    this.name = "ChessComError";
    this.code = code;
  }
}

const USERNAME_RE = /^[A-Za-z0-9_-]{3,25}$/;

export function normalizeUsername(input: string): string {
  const trimmed = input.trim().replace(/^@/, "");
  // Accept a pasted profile URL such as https://www.chess.com/member/name
  const fromUrl = /chess\.com\/(?:member|players?)\/([A-Za-z0-9_-]+)/i.exec(trimmed);
  const name = fromUrl ? fromUrl[1] : trimmed;
  if (!USERNAME_RE.test(name)) {
    throw new ChessComError("INVALID_USERNAME", "Chess.com usernames are 3–25 characters: letters, numbers, “_” or “-”.");
  }
  return name.toLowerCase();
}

/** Only allow requests to the public API on the exact origin. */
export function assertApiUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ChessComError("INVALID_URL", "Invalid Chess.com API URL.");
  }
  if (parsed.origin !== API_ORIGIN || !parsed.pathname.startsWith("/pub/")) {
    throw new ChessComError("INVALID_URL", "Refusing to request a URL outside api.chess.com/pub.");
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Serial request queue
// ---------------------------------------------------------------------------
let queue: Promise<unknown> = Promise.resolve();
const inflight = new Map<string, Promise<unknown>>();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

async function fetchOnce(url: string, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort);
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" }, credentials: "omit" });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (controller.signal.aborted) throw new ChessComError("TIMEOUT", "Chess.com took too long to respond. Please try again.");
    throw new ChessComError("NETWORK", "Could not reach Chess.com. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function requestJson(url: string, signal?: AbortSignal): Promise<unknown> {
  assertApiUrl(url);
  for (let attempt = 0; ; attempt++) {
    const res = await fetchOnce(url, signal);
    if (res.ok) {
      try {
        return await res.json();
      } catch {
        throw new ChessComError("BAD_RESPONSE", "Chess.com returned data that could not be read.");
      }
    }
    if (res.status === 404 || res.status === 410) {
      throw new ChessComError("NOT_FOUND", "No public Chess.com account or archive was found for that name.");
    }
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt >= MAX_RETRIES) {
      if (res.status === 429) throw new ChessComError("RATE_LIMITED", "Chess.com is rate-limiting requests. Wait a minute and try again.");
      throw new ChessComError("SERVER", `Chess.com responded with an error (HTTP ${res.status}).`);
    }
    const retryAfter = Number(res.headers.get("Retry-After"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(30, retryAfter) * 1000 : 1000 * 2 ** attempt;
    await sleep(delay, signal);
  }
}

/** Cached, deduplicated, serial GET. */
async function getJson(url: string, ttlMs: number | null, signal?: AbortSignal): Promise<unknown> {
  const cached = await cacheGet(url);
  if (cached && (ttlMs === null || Date.now() - cached.fetchedAt < ttlMs)) return cached.data;
  const existing = inflight.get(url);
  if (existing) return existing;
  const p = enqueue(() => requestJson(url, signal))
    .then(async (data) => {
      await cacheSet(url, data);
      return data;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

// ---------------------------------------------------------------------------
// Schemas (validated leniently: unknown fields are ignored)
// ---------------------------------------------------------------------------
const ProfileSchema = z.object({
  username: z.string(),
  player_id: z.number().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  joined: z.number().optional(),
  last_online: z.number().optional(),
});

const ArchivesSchema = z.object({ archives: z.array(z.string()) });

const PlayerSchema = z.object({
  username: z.string(),
  rating: z.number().optional(),
  result: z.string(),
});

const GameSchema = z.object({
  url: z.string().optional(),
  pgn: z.string().optional(),
  time_control: z.string().optional(),
  end_time: z.number().optional(),
  rated: z.boolean().optional(),
  time_class: z.string().optional(),
  rules: z.string().optional(),
  eco: z.string().optional(),
  white: PlayerSchema,
  black: PlayerSchema,
  accuracies: z.object({ white: z.number(), black: z.number() }).partial().optional(),
});

const MonthSchema = z.object({ games: z.array(z.unknown()) });

export type ChessComProfile = z.infer<typeof ProfileSchema>;

export interface ArchiveMonth {
  url: string;
  year: number;
  month: number;
  label: string;
}

export type Outcome = "win" | "loss" | "draw";

export interface ChessComGameSummary {
  id: string;
  url?: string;
  pgn: string;
  white: { username: string; rating?: number; result: string };
  black: { username: string; rating?: number; result: string };
  timeClass: TimeClass | "unknown";
  timeControl?: string;
  rated?: boolean;
  endTime?: number;
  /** Colour played by the searched user, if they took part. */
  userColor: Color | null;
  outcome: Outcome | null;
  openingName?: string;
  chessComAccuracies?: { white?: number; black?: number };
}

const DRAW_CODES = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);

export function outcomeFromResult(result: string): Outcome {
  if (result === "win") return "win";
  if (DRAW_CODES.has(result)) return "draw";
  return "loss";
}

/** Chess.com eco URLs look like https://www.chess.com/openings/Sicilian-Defense-Najdorf... */
export function openingFromEcoUrl(eco: string | undefined): string | undefined {
  if (!eco) return undefined;
  const m = /chess\.com\/openings\/([^?#]+)/.exec(eco);
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1]).replace(/-/g, " ").replace(/\s+\d+\.\.\..*$/, "").replace(/\s+\d+\..*$/, "").trim() || undefined;
  } catch {
    return undefined;
  }
}

function toTimeClass(value: string | undefined): TimeClass | "unknown" {
  if (value === "bullet" || value === "blitz" || value === "rapid" || value === "daily") return value;
  if (value === "classical" || value === "standard") return "classical";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function fetchProfile(username: string, signal?: AbortSignal): Promise<ChessComProfile> {
  const name = normalizeUsername(username);
  const data = await getJson(`${API_ORIGIN}/pub/player/${name}`, SHORT_TTL_MS, signal);
  const parsed = ProfileSchema.safeParse(data);
  if (!parsed.success) throw new ChessComError("BAD_RESPONSE", "Unexpected profile data from Chess.com.");
  return parsed.data;
}

export async function fetchArchives(username: string, signal?: AbortSignal): Promise<ArchiveMonth[]> {
  const name = normalizeUsername(username);
  const data = await getJson(`${API_ORIGIN}/pub/player/${name}/games/archives`, SHORT_TTL_MS, signal);
  const parsed = ArchivesSchema.safeParse(data);
  if (!parsed.success) throw new ChessComError("BAD_RESPONSE", "Unexpected archive list from Chess.com.");
  const months: ArchiveMonth[] = [];
  for (const url of parsed.data.archives) {
    const m = /\/games\/(\d{4})\/(\d{2})$/.exec(url);
    if (!m) continue;
    try {
      assertApiUrl(url);
    } catch {
      continue;
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
    months.push({ url, year, month, label });
  }
  return months.reverse(); // newest first
}

function isCurrentMonth(m: ArchiveMonth): boolean {
  const now = new Date();
  return m.year === now.getUTCFullYear() && m.month === now.getUTCMonth() + 1;
}

export interface MonthGames {
  games: ChessComGameSummary[];
  /** Games skipped because they are variants or have no PGN. */
  skipped: number;
}

export async function fetchMonthGames(username: string, month: ArchiveMonth, signal?: AbortSignal): Promise<MonthGames> {
  const user = normalizeUsername(username);
  let data: unknown;
  try {
    data = await getJson(month.url, isCurrentMonth(month) ? SHORT_TTL_MS : null, signal);
  } catch (err) {
    // The archive list already proved the account exists. Chess.com
    // sometimes answers 404 ("internal error") for one month — notably the
    // current month of very active accounts — so report it as such.
    if (err instanceof ChessComError && err.code === "NOT_FOUND") {
      throw new ChessComError("MONTH_UNAVAILABLE", `Chess.com couldn't return the games for ${month.label}. Choose another month.`);
    }
    throw err;
  }
  const parsed = MonthSchema.safeParse(data);
  if (!parsed.success) throw new ChessComError("BAD_RESPONSE", "Unexpected game archive data from Chess.com.");
  const games: ChessComGameSummary[] = [];
  let skipped = 0;
  for (const raw of parsed.data.games) {
    const g = GameSchema.safeParse(raw);
    if (!g.success || !g.data.pgn || (g.data.rules && g.data.rules !== "chess")) {
      skipped++;
      continue;
    }
    const game = g.data;
    const userColor: Color | null =
      game.white.username.toLowerCase() === user ? "w" : game.black.username.toLowerCase() === user ? "b" : null;
    const mine = userColor === "w" ? game.white : userColor === "b" ? game.black : null;
    games.push({
      id: game.url ?? `${game.end_time ?? 0}-${game.white.username}-${game.black.username}`,
      url: game.url,
      pgn: game.pgn ?? "",
      white: game.white,
      black: game.black,
      timeClass: toTimeClass(game.time_class),
      timeControl: game.time_control,
      rated: game.rated,
      endTime: game.end_time,
      userColor,
      outcome: mine ? outcomeFromResult(mine.result) : null,
      openingName: openingFromEcoUrl(game.eco),
      chessComAccuracies: game.accuracies,
    });
  }
  games.sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0));
  return { games, skipped };
}

/** Convert a Chess.com summary into a fully parsed, validated game. */
export function importChessComGame(summary: ChessComGameSummary): ImportedGame {
  const timeClass = summary.timeClass === "unknown" ? undefined : summary.timeClass;
  return parseSingleGame(summary.pgn, {
    source: "chesscom",
    extra: {
      rated: summary.rated,
      ...(timeClass ? { timeClass } : {}),
      ...(summary.url ? { link: summary.url } : {}),
      ...(summary.openingName ? { openingName: summary.openingName } : {}),
      ...(summary.chessComAccuracies ? { chessComAccuracy: summary.chessComAccuracies } : {}),
    },
  });
}

/**
 * Recognise a pasted Chess.com game URL. The Published-Data API has no
 * endpoint for a single game by id, so we return the parsed id and let the
 * UI explain how to export the PGN (or find the game via the username flow).
 */
export function parseChessComGameUrl(input: string): { kind: "live" | "daily"; gameId: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !/^(www\.)?chess\.com$/.test(url.hostname)) return null;
  const m = /^\/(?:analysis\/)?game\/(live|daily)\/(\d+)/.exec(url.pathname) ?? /^\/(live|daily)\/game\/(\d+)/.exec(url.pathname);
  if (!m) return null;
  return { kind: m[1] as "live" | "daily", gameId: m[2] };
}
