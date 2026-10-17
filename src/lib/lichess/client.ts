import { z } from "zod";
import { parseSingleGame } from "@/lib/chess/pgn";
import type { Color, ImportedGame, TimeClass } from "@/lib/chess/types";
import { cacheGet, cacheSet } from "@/lib/storage/db";

/**
 * Client for the Lichess public API (https://lichess.org/api), public data
 * only, no authentication. Mirrors the Chess.com client:
 * - only https://lichess.org/api/… and /game/export/… are ever requested;
 * - requests are strictly serial; on HTTP 429 we wait a minute, as Lichess asks;
 * - finished months are cached; the current month briefly.
 */
export const LICHESS_ORIGIN = "https://lichess.org";
const TIMEOUT_MS = 20_000;
const SHORT_TTL_MS = 10 * 60 * 1000;
const MAX_GAMES_PER_MONTH = 300;

export type LichessErrorCode = "INVALID_USERNAME" | "NOT_FOUND" | "RATE_LIMITED" | "NETWORK" | "TIMEOUT" | "SERVER" | "BAD_RESPONSE" | "INVALID_URL";

export class LichessError extends Error {
  readonly code: LichessErrorCode;
  constructor(code: LichessErrorCode, message: string) {
    super(message);
    this.name = "LichessError";
    this.code = code;
  }
}

const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,28}[A-Za-z0-9]$/;

export function normalizeLichessUsername(input: string): string {
  const trimmed = input.trim().replace(/^@/, "");
  const fromUrl = /lichess\.org\/@\/([A-Za-z0-9_-]+)/i.exec(trimmed);
  const name = fromUrl ? fromUrl[1] : trimmed;
  if (!USERNAME_RE.test(name)) {
    throw new LichessError("INVALID_USERNAME", "Lichess usernames are 2–30 characters: letters, numbers, “_” or “-”.");
  }
  return name.toLowerCase();
}

export function assertLichessUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new LichessError("INVALID_URL", "Invalid Lichess URL.");
  }
  if (parsed.origin !== LICHESS_ORIGIN || !(parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/game/export/"))) {
    throw new LichessError("INVALID_URL", "Refusing to request a URL outside the Lichess API.");
  }
  return parsed;
}

// ---- serial requests ----------------------------------------------------------
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function request(url: string, accept: string, signal?: AbortSignal): Promise<string> {
  assertLichessUrl(url);
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: accept }, signal: controller.signal, credentials: "omit" });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (controller.signal.aborted) throw new LichessError("TIMEOUT", "Lichess took too long to respond. Please try again.");
      throw new LichessError("NETWORK", "Could not reach Lichess. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    if (res.ok) return res.text();
    if (res.status === 404) throw new LichessError("NOT_FOUND", "No Lichess account or game was found.");
    if (res.status === 429) {
      if (attempt >= 1) throw new LichessError("RATE_LIMITED", "Lichess is rate-limiting requests. Wait a minute and try again.");
      await new Promise((r) => setTimeout(r, 60_000));
      continue;
    }
    throw new LichessError("SERVER", `Lichess responded with an error (HTTP ${res.status}).`);
  }
}

async function cached<T>(url: string, ttlMs: number | null, load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet(url);
  if (hit && (ttlMs === null || Date.now() - hit.fetchedAt < ttlMs)) return hit.data as T;
  const data = await enqueue(load);
  await cacheSet(url, data);
  return data;
}

// ---- schemas ------------------------------------------------------------------------
const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  title: z.string().optional(),
  createdAt: z.number(),
  disabled: z.boolean().optional(),
  tosViolation: z.boolean().optional(),
});

const PlayerSchema = z.object({
  user: z.object({ name: z.string() }).optional(),
  aiLevel: z.number().optional(),
  rating: z.number().optional(),
});

const GameSchema = z.object({
  id: z.string(),
  rated: z.boolean().optional(),
  variant: z.string(),
  speed: z.string(),
  createdAt: z.number(),
  lastMoveAt: z.number().optional(),
  status: z.string(),
  winner: z.enum(["white", "black"]).optional(),
  players: z.object({ white: PlayerSchema, black: PlayerSchema }),
  opening: z.object({ eco: z.string(), name: z.string() }).optional(),
  pgn: z.string().optional(),
});

export type LichessProfile = z.infer<typeof UserSchema>;

export interface LichessMonth {
  year: number;
  month: number;
  label: string;
  since: number;
  until: number;
}

export type Outcome = "win" | "loss" | "draw";

export interface LichessGameSummary {
  id: string;
  url: string;
  pgn: string;
  white: { username: string; rating?: number };
  black: { username: string; rating?: number };
  timeClass: TimeClass | "unknown";
  rated?: boolean;
  endTime: number;
  userColor: Color | null;
  outcome: Outcome | null;
  openingName?: string;
}

const SPEED: Record<string, TimeClass> = { bullet: "bullet", ultraBullet: "bullet", blitz: "blitz", rapid: "rapid", classical: "classical", correspondence: "daily" };
const UNFINISHED = new Set(["created", "started", "aborted", "unknownFinish"]);

function playerName(p: z.infer<typeof PlayerSchema>): string {
  return p.user?.name ?? (p.aiLevel ? `Stockfish level ${p.aiLevel}` : "Anonymous");
}

// ---- public API --------------------------------------------------------------------
export async function fetchLichessProfile(username: string, signal?: AbortSignal): Promise<LichessProfile> {
  const name = normalizeLichessUsername(username);
  const url = `${LICHESS_ORIGIN}/api/user/${name}`;
  const data = await cached(url, SHORT_TTL_MS, async () => JSON.parse(await request(url, "application/json", signal)) as unknown);
  const parsed = UserSchema.safeParse(data);
  if (!parsed.success) throw new LichessError("BAD_RESPONSE", "Unexpected profile data from Lichess.");
  if (parsed.data.disabled) throw new LichessError("NOT_FOUND", "That Lichess account is closed.");
  return parsed.data;
}

/** Months from account creation to now, newest first. */
export function lichessMonths(createdAt: number, now = new Date()): LichessMonth[] {
  const out: LichessMonth[] = [];
  const start = new Date(createdAt);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  while (y > start.getUTCFullYear() || (y === start.getUTCFullYear() && m >= start.getUTCMonth())) {
    const since = Date.UTC(y, m, 1);
    const until = Date.UTC(y, m + 1, 1) - 1;
    const label = new Date(since).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
    out.push({ year: y, month: m + 1, label, since, until });
    m--;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (out.length >= 240) break;
  }
  return out;
}

/** Unfinished games have no outcome; a finished game without a winner is a draw. */
export function outcomeFor(winner: "white" | "black" | undefined, status: string, color: Color): Outcome | null {
  if (UNFINISHED.has(status)) return null;
  if (!winner) return "draw";
  return (winner === "white") === (color === "w") ? "win" : "loss";
}

/** Parse Lichess NDJSON (one game per line); invalid lines are skipped. */
export function parseLichessNdjson(text: string, user: string): { games: LichessGameSummary[]; skipped: number } {
  const games: LichessGameSummary[] = [];
  let skipped = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    const g = GameSchema.safeParse(raw);
    if (!g.success || g.data.variant !== "standard" || !g.data.pgn || /\[SetUp "1"\]/.test(g.data.pgn)) {
      skipped++;
      continue;
    }
    const d = g.data;
    const pgn = d.pgn ?? ""; // checked non-empty above
    const white = { username: playerName(d.players.white), rating: d.players.white.rating };
    const black = { username: playerName(d.players.black), rating: d.players.black.rating };
    const userColor: Color | null = white.username.toLowerCase() === user ? "w" : black.username.toLowerCase() === user ? "b" : null;
    games.push({
      id: d.id,
      url: `${LICHESS_ORIGIN}/${d.id}`,
      pgn,
      white,
      black,
      timeClass: SPEED[d.speed] ?? "unknown",
      rated: d.rated,
      endTime: d.lastMoveAt ?? d.createdAt,
      userColor,
      outcome: userColor ? outcomeFor(d.winner, d.status, userColor) : null,
      openingName: d.opening?.name,
    });
  }
  return { games, skipped };
}

export async function fetchLichessMonthGames(username: string, month: LichessMonth, signal?: AbortSignal): Promise<{ games: LichessGameSummary[]; skipped: number }> {
  const name = normalizeLichessUsername(username);
  const url = `${LICHESS_ORIGIN}/api/games/user/${name}?since=${month.since}&until=${month.until}&max=${MAX_GAMES_PER_MONTH}&pgnInJson=true&clocks=true&opening=true`;
  const isCurrent = Date.now() <= month.until;
  const text = await cached(url, isCurrent ? SHORT_TTL_MS : null, () => request(url, "application/x-ndjson", signal));
  return parseLichessNdjson(text, name);
}

/** Recognise a pasted Lichess game link and return its 8-character game id. */
export function parseLichessGameUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !/^(www\.)?lichess\.org$/.test(url.hostname)) return null;
  const m = /^\/([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:\/(?:white|black))?\/?$/.exec(url.pathname);
  return m ? m[1] : null;
}

/** Fetch a single public game by id (unlike Chess.com, Lichess supports this). */
export async function fetchLichessGame(id: string, signal?: AbortSignal): Promise<ImportedGame> {
  if (!/^[A-Za-z0-9]{8}$/.test(id)) throw new LichessError("INVALID_URL", "That is not a valid Lichess game link.");
  const url = `${LICHESS_ORIGIN}/game/export/${id}?clocks=true&evals=false`;
  const pgn = await cached(url, null, () => request(url, "application/x-chess-pgn", signal));
  return parseSingleGame(pgn, { source: "lichess", extra: { link: `${LICHESS_ORIGIN}/${id}` } });
}

export function importLichessGame(summary: LichessGameSummary): ImportedGame {
  const timeClass = summary.timeClass === "unknown" ? undefined : summary.timeClass;
  return parseSingleGame(summary.pgn, {
    source: "lichess",
    extra: {
      rated: summary.rated,
      link: summary.url,
      ...(timeClass ? { timeClass } : {}),
      ...(summary.openingName ? { openingName: summary.openingName } : {}),
    },
  });
}
