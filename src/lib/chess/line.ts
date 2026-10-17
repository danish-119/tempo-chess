import { Chess, type Move, type Square } from "chess.js";
import type { PieceSymbol } from "./types";

export interface LineStep {
  move: Move;
  fen: string;
}

export function parseUci(uci: string): { from: Square; to: Square; promotion?: PieceSymbol } | null {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!m) return null;
  return { from: m[1] as Square, to: m[2] as Square, promotion: m[3] as PieceSymbol | undefined };
}

/** Apply one UCI move to a position. Returns null if illegal. */
export function applyUci(chess: Chess, uci: string): Move | null {
  const parsed = parseUci(uci);
  if (!parsed) return null;
  try {
    return chess.move(parsed);
  } catch {
    return null;
  }
}

/**
 * Play a UCI line from a FEN, stopping at the first illegal move. Every move
 * is validated by chess.js, so the returned steps are always legal.
 */
export function playLine(fen: string, uciMoves: string[], maxPlies = uciMoves.length): LineStep[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  const steps: LineStep[] = [];
  for (const uci of uciMoves.slice(0, maxPlies)) {
    const move = applyUci(chess, uci);
    if (!move) break;
    steps.push({ move, fen: chess.fen() });
  }
  return steps;
}

export function uciLineToSan(fen: string, uciMoves: string[], maxPlies?: number): string[] {
  return playLine(fen, uciMoves, maxPlies).map((s) => s.move.san);
}

export function uciToSan(fen: string, uci: string): string | null {
  return playLine(fen, [uci], 1)[0]?.move.san ?? null;
}

/** Format a SAN line with move numbers, starting from `fen`. */
export function formatSanLine(fen: string, sans: string[]): string {
  const parts = fen.split(" ");
  let moveNo = Number(parts[5]) || 1;
  let white = parts[1] !== "b";
  const out: string[] = [];
  sans.forEach((san, i) => {
    if (white) out.push(`${moveNo}. ${san}`);
    else out.push(i === 0 ? `${moveNo}… ${san}` : san);
    if (!white) moveNo++;
    white = !white;
  });
  return out.join(" ");
}

export function legalMoveCount(fen: string): number {
  try {
    return new Chess(fen).moves().length;
  } catch {
    return 0;
  }
}

export type TerminalState = "checkmate" | "stalemate" | "draw" | null;

export function terminalState(fen: string): TerminalState {
  try {
    const c = new Chess(fen);
    if (c.isCheckmate()) return "checkmate";
    if (c.isStalemate()) return "stalemate";
    if (c.isInsufficientMaterial() || c.isThreefoldRepetition()) return "draw";
    return null;
  } catch {
    return null;
  }
}

export function sideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}
