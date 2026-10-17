import { z } from "zod";

/**
 * Lichess opening explorer (https://lichess.org/api#tag/Opening-Explorer).
 * Requires an OAuth token from a logged-in Lichess user (see ./auth.ts).
 *  - masters: ~2M over-the-board games by players rated 2200+.
 *  - lichess: rated Lichess games, filtered to blitz/rapid/classical, 1600+.
 */
export const EXPLORER_ORIGIN = "https://explorer.lichess.org";
const TIMEOUT_MS = 12_000;

export type ExplorerDb = "masters" | "lichess";

const MoveSchema = z.object({
  uci: z.string(),
  san: z.string(),
  white: z.number(),
  draws: z.number(),
  black: z.number(),
  averageRating: z.number().nullable().optional(),
});
const ResultSchema = z.object({
  white: z.number(),
  draws: z.number(),
  black: z.number(),
  moves: z.array(MoveSchema),
  opening: z.object({ eco: z.string(), name: z.string() }).nullable().optional(),
});

export type ExplorerMove = z.infer<typeof MoveSchema>;
export type ExplorerResult = z.infer<typeof ResultSchema>;

export type ExplorerErrorCode = "UNAUTHORIZED" | "RATE_LIMITED" | "NETWORK" | "BAD_RESPONSE";

export class ExplorerError extends Error {
  readonly code: ExplorerErrorCode;
  constructor(code: ExplorerErrorCode, message: string) {
    super(message);
    this.name = "ExplorerError";
    this.code = code;
  }
}

export function explorerUrl(db: ExplorerDb, fen: string): string {
  const q = new URLSearchParams({ fen, moves: "12", topGames: "0" });
  if (db === "lichess") {
    q.set("variant", "standard");
    q.set("speeds", "blitz,rapid,classical");
    q.set("ratings", "1600,1800,2000,2200,2500");
    q.set("recentGames", "0");
  }
  return `${EXPLORER_ORIGIN}/${db}?${q.toString()}`;
}

export const totalGames = (r: { white: number; draws: number; black: number }) => r.white + r.draws + r.black;

/** White / draw / Black shares in percent (rounded, summing to 100). */
export function shares(r: { white: number; draws: number; black: number }): [number, number, number] {
  const t = totalGames(r);
  if (t === 0) return [0, 0, 0];
  const w = Math.round((r.white / t) * 100);
  const b = Math.round((r.black / t) * 100);
  return [w, Math.max(0, 100 - w - b), b];
}

const cache = new Map<string, ExplorerResult>();
// The explorer allows one request at a time per client; keep them serial.
let chain: Promise<unknown> = Promise.resolve();

export function fetchExplorer(db: ExplorerDb, fen: string, token: string, signal?: AbortSignal): Promise<ExplorerResult> {
  const url = explorerUrl(db, fen);
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  const run = async (): Promise<ExplorerResult> => {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new ExplorerError("NETWORK", "The opening explorer could not be reached.");
    }
    if (res.status === 401) throw new ExplorerError("UNAUTHORIZED", "Your Lichess login has expired. Connect again to use the explorer.");
    if (res.status === 429) throw new ExplorerError("RATE_LIMITED", "The explorer is busy. Wait a minute and try again.");
    if (!res.ok) throw new ExplorerError("BAD_RESPONSE", "The opening explorer returned an error.");
    const parsed = ResultSchema.safeParse(await res.json());
    if (!parsed.success) throw new ExplorerError("BAD_RESPONSE", "Unexpected explorer response.");
    if (cache.size > 300) cache.clear();
    cache.set(url, parsed.data);
    return parsed.data;
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}
