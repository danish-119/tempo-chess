import type { Color, PieceSymbol } from "./types";

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export interface MaterialCount {
  w: number;
  b: number;
  /** Count of non-pawn, non-king pieces for both sides. */
  minorMajorPieces: number;
  pieces: Record<Color, Record<PieceSymbol, number>>;
}

/** Count material directly from the FEN board field (fast, no chess.js). */
export function countMaterial(fen: string): MaterialCount {
  const board = fen.split(" ")[0] ?? "";
  const empty = (): Record<PieceSymbol, number> => ({ p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 });
  const pieces: Record<Color, Record<PieceSymbol, number>> = { w: empty(), b: empty() };
  let w = 0;
  let b = 0;
  let minorMajorPieces = 0;
  for (const ch of board) {
    const lower = ch.toLowerCase() as PieceSymbol;
    if (!(lower in PIECE_VALUE)) continue;
    const color: Color = ch === lower ? "b" : "w";
    pieces[color][lower]++;
    if (color === "w") w += PIECE_VALUE[lower];
    else b += PIECE_VALUE[lower];
    if (lower !== "p" && lower !== "k") minorMajorPieces++;
  }
  return { w, b, minorMajorPieces, pieces };
}

/** Material balance from `player`'s point of view (positive = ahead). */
export function materialBalance(fen: string, player: Color): number {
  const m = countMaterial(fen);
  return player === "w" ? m.w - m.b : m.b - m.w;
}

export function describeMaterial(points: number): string {
  if (points >= 9) return "a queen's worth of material";
  if (points >= 5) return "a rook's worth of material";
  if (points >= 3) return "a piece";
  if (points === 2) return "the exchange or two pawns";
  return "a pawn";
}
