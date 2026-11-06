import { Chess } from "chess.js";
import { applyUci } from "@/lib/chess/line";
import { START_FEN } from "@/lib/chess/types";

/**
 * Threefold repetition needs the history of a game. A Chess object rebuilt from a FEN string has none,
 * so it can never report a repetition; these helpers work from the list of moves instead.
 */

/** What makes two positions "the same": piece placement, side to move, castling rights and en-passant square. */
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** True when the position reached after the last move has now occurred three or more times. */
export function isThreefoldRepetition(moves: readonly string[], startFen: string = START_FEN): boolean {
  const chess = new Chess(startFen);
  const counts = new Map<string, number>();
  let key = positionKey(chess.fen());
  counts.set(key, 1);
  for (const uci of moves) {
    if (!applyUci(chess, uci)) break;
    key = positionKey(chess.fen());
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (counts.get(key) ?? 0) >= 3;
}
