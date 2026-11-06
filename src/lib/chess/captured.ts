import { countMaterial, materialBalance } from "@/lib/chess/material";
import { type PieceSymbol, START_FEN } from "@/lib/chess/types";

/** Display order: cheapest first, as on most chess sites. */
const ORDER = ["p", "n", "b", "r", "q"] as const;
const PROMOTION_TARGETS = ["n", "b", "r", "q"] as const;

/** The pieces of `color` that are missing from `fen` compared with `baseFen` (the position the game began from). */
function lostPieces(fen: string, baseFen: string, color: "w" | "b"): PieceSymbol[] {
  const now = countMaterial(fen).pieces[color];
  const base = countMaterial(baseFen).pieces[color];
  // A promoted pawn is missing as a pawn but is not captured: it shows up as an extra piece instead.
  let promoted = 0;
  for (const t of PROMOTION_TARGETS) promoted += Math.max(0, now[t] - base[t]);
  const out: PieceSymbol[] = [];
  for (const t of ORDER) {
    let missing = Math.max(0, base[t] - now[t]);
    if (t === "p") missing = Math.max(0, missing - promoted);
    for (let i = 0; i < missing; i++) out.push(t);
  }
  return out;
}

export interface CapturedSummary {
  /** Black pieces White has captured, cheapest first. */
  byWhite: PieceSymbol[];
  /** White pieces Black has captured, cheapest first. */
  byBlack: PieceSymbol[];
  /** Material on the board from White's point of view (positive = White is ahead), in pawns. */
  balance: number;
}

/**
 * What each side has captured and who leads in material, worked out from the position alone, so it also
 * follows when you step back through a game. Pass `baseFen` for games that began from a custom position.
 */
export function capturedPieces(fen: string, baseFen: string = START_FEN): CapturedSummary {
  return {
    byWhite: lostPieces(fen, baseFen, "b"),
    byBlack: lostPieces(fen, baseFen, "w"),
    balance: materialBalance(fen, "w"),
  };
}

const NAME: Record<PieceSymbol, [string, string]> = {
  p: ["pawn", "pawns"],
  n: ["knight", "knights"],
  b: ["bishop", "bishops"],
  r: ["rook", "rooks"],
  q: ["queen", "queens"],
  k: ["king", "kings"],
};

/** "2 pawns, 1 knight" for screen readers. */
export function describePieces(pieces: readonly PieceSymbol[]): string {
  const counts = new Map<PieceSymbol, number>();
  for (const p of pieces) counts.set(p, (counts.get(p) ?? 0) + 1);
  return ORDER.filter((t) => counts.has(t))
    .map((t) => `${counts.get(t)} ${NAME[t][(counts.get(t) ?? 0) === 1 ? 0 : 1]}`)
    .join(", ");
}
