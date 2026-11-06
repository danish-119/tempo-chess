import { Chess, type Square } from "chess.js";
import { MOVE_CLASS_LABEL, type MoveClass } from "@/lib/review/types";

const PIECE_NAME: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

/**
 * Plain-language description of the move that led to `fen`, for screen
 * readers: "White knight to f3, check. Best move." Returns null when there is
 * no last move or the destination square is empty (bad input).
 */
export function describeMove(
  fen: string,
  lastMove: { from: string; to: string } | null | undefined,
  classification?: MoveClass | null,
): string | null {
  if (!lastMove) return null;
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  const piece = chess.get(lastMove.to as Square);
  if (!piece) return null;
  const who = piece.color === "w" ? "White" : "Black";
  let text = `${who} ${PIECE_NAME[piece.type]} to ${lastMove.to}`;
  if (chess.isCheckmate()) text += ", checkmate";
  else if (chess.inCheck()) text += ", check";
  else if (chess.isStalemate()) text += ", stalemate";
  text += ".";
  if (classification) text += ` ${MOVE_CLASS_LABEL[classification]}.`;
  return text;
}
