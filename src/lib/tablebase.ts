import { z } from "zod";

/**
 * Lichess endgame tablebase (Syzygy up to 7 pieces, free, no account,
 * CORS-enabled): https://tablebase.lichess.ovh
 * Exact results for every position with ≤ 7 pieces (kings included).
 */
export const TABLEBASE_ORIGIN = "https://tablebase.lichess.ovh";
export const TABLEBASE_MAX_PIECES = 7;
const TIMEOUT_MS = 10_000;

const CATEGORY = z.enum(["win", "unknown", "syzygy-win", "maybe-win", "cursed-win", "draw", "blessed-loss", "maybe-loss", "syzygy-loss", "loss"]);
export type TablebaseCategory = z.infer<typeof CATEGORY>;

const Num = z.number().nullable().optional();
const MoveSchema = z.object({
  uci: z.string(),
  san: z.string(),
  category: CATEGORY,
  dtz: Num,
  dtm: Num,
  zeroing: z.boolean().optional(),
  checkmate: z.boolean().optional(),
  stalemate: z.boolean().optional(),
});
const ResultSchema = z.object({
  category: CATEGORY,
  dtz: Num,
  dtm: Num,
  checkmate: z.boolean().optional(),
  stalemate: z.boolean().optional(),
  insufficient_material: z.boolean().optional(),
  moves: z.array(MoveSchema),
});

export type TablebaseMove = z.infer<typeof MoveSchema>;
export type TablebaseResult = z.infer<typeof ResultSchema>;

/** Number of pieces (kings included) in a FEN. */
export function pieceCount(fen: string): number {
  return (fen.split(" ")[0].match(/[pnbrqk]/gi) ?? []).length;
}

export function tablebaseApplies(fen: string): boolean {
  return pieceCount(fen) <= TABLEBASE_MAX_PIECES;
}

export function tablebaseUrl(fen: string): string {
  return `${TABLEBASE_ORIGIN}/standard?fen=${encodeURIComponent(fen)}`;
}

/** Simplified outcome for the side to move. */
export type Outcome = "win" | "draw" | "loss" | "unknown";

export function outcomeOf(category: TablebaseCategory): Outcome {
  if (category === "win" || category === "syzygy-win" || category === "maybe-win") return "win";
  if (category === "loss" || category === "syzygy-loss" || category === "maybe-loss") return "loss";
  // Cursed wins / blessed losses are draws under the 50-move rule.
  if (category === "draw" || category === "cursed-win" || category === "blessed-loss") return "draw";
  return "unknown";
}

/** Outcome for the mover after playing `move` (the API reports the opponent's view). */
export function moveOutcome(move: TablebaseMove): Outcome {
  const o = outcomeOf(move.category);
  return o === "win" ? "loss" : o === "loss" ? "win" : o;
}

/** "Mate in 9", "DTZ 12", or null — from the side-to-move's point of view. */
export function distanceLabel(dtm: number | null | undefined, dtz: number | null | undefined): string | null {
  if (dtm !== null && dtm !== undefined && dtm !== 0) return `Mate in ${Math.ceil(Math.abs(dtm) / 2)}`;
  if (dtz !== null && dtz !== undefined && dtz !== 0) return `DTZ ${Math.abs(dtz)}`;
  return null;
}

/** Headline such as "White wins · Mate in 9" or "Draw". */
export function verdict(result: TablebaseResult, turn: "w" | "b"): string {
  const side = turn === "w" ? "White" : "Black";
  const other = turn === "w" ? "Black" : "White";
  if (result.checkmate) return `Checkmate — ${other} wins`;
  if (result.stalemate) return "Stalemate — draw";
  if (result.insufficient_material) return "Draw — insufficient material";
  const o = outcomeOf(result.category);
  if (o === "draw") return result.category === "draw" ? "Draw" : "Draw (50-move rule)";
  if (o === "unknown") return "Result unknown";
  const dist = distanceLabel(result.dtm, result.dtz);
  return `${o === "win" ? side : other} wins${dist ? ` · ${dist}` : ""}`;
}

const cache = new Map<string, TablebaseResult>();

export class TablebaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TablebaseError";
  }
}

export async function fetchTablebase(fen: string, signal?: AbortSignal): Promise<TablebaseResult> {
  const hit = cache.get(fen);
  if (hit) return hit;
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(tablebaseUrl(fen), { signal: combined, headers: { Accept: "application/json" } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new TablebaseError("The tablebase could not be reached.");
  }
  if (res.status === 429) throw new TablebaseError("The tablebase is busy. Try again in a minute.");
  if (!res.ok) throw new TablebaseError("The tablebase has no answer for this position.");
  const parsed = ResultSchema.safeParse(await res.json());
  if (!parsed.success) throw new TablebaseError("Unexpected tablebase response.");
  if (cache.size > 500) cache.clear();
  cache.set(fen, parsed.data);
  return parsed.data;
}
