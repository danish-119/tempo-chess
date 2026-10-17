import { Chess, type Square } from "chess.js";
import { PIECE_VALUE, materialBalance } from "@/lib/chess/material";
import { playLine } from "@/lib/chess/line";
import type { PieceSymbol } from "@/lib/chess/types";

/**
 * Sacrifice detection for Tempo's "Brilliant" class. A move is a sacrifice
 * of at least MIN_SAC points (more than a pawn) if EITHER:
 *
 *  1. Realised: along the engine's best defence, after the opponent's reply
 *     and the mover's next move, the mover is ≥ MIN_SAC points down compared
 *     with before the move. (Measuring after the mover's reply means simple
 *     trades and recaptures never count.)
 *  2. Offered: the moved piece (worth ≥ 3) stands on a square where the
 *     opponent can take it and it is either undefended or attacked by a
 *     cheaper piece, and the move did not capture something of similar value.
 *
 * Both checks use only legal moves verified by chess.js.
 */
export const MIN_SAC = 2;

export function isSacrifice(fenBefore: string, playedUci: string, replyLine: string[]): boolean {
  const steps = playLine(fenBefore, [playedUci, ...replyLine], 3);
  const played = steps[0];
  if (!played) return false;
  const mover = played.move.color;
  const opp = mover === "w" ? "b" : "w";
  const before = materialBalance(fenBefore, mover);

  // 1. Realised sacrifice along the engine line.
  if (steps.length >= 2 && steps[1].move.captured) {
    const measured = steps[2] ?? steps[1];
    if (before - materialBalance(measured.fen, mover) >= MIN_SAC) return true;
  }

  // 2. Piece left en prise.
  const piece = played.move.piece as PieceSymbol;
  const value = PIECE_VALUE[piece];
  if (piece === "k" || value < 3) return false;
  const capturedValue = played.move.captured ? PIECE_VALUE[played.move.captured as PieceSymbol] : 0;
  if (value - capturedValue < MIN_SAC) return false;
  const chess = new Chess(played.fen);
  const to = played.move.to as Square;
  const attackers = chess.attackers(to, opp);
  if (attackers.length === 0) return false;
  const defenders = chess.attackers(to, mover);
  const cheapest = Math.min(...attackers.map((sq) => PIECE_VALUE[(chess.get(sq)?.type ?? "q") as PieceSymbol]));
  return defenders.length === 0 || value - cheapest >= MIN_SAC;
}
