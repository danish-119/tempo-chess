import { Chess } from "chess.js";
import { PIECE_NAME } from "@/lib/chess/material";
import { parseUci, playLine } from "@/lib/chess/line";
import type { Color, PieceSymbol } from "@/lib/chess/types";
import type { AnalysisSnapshot } from "@/lib/engine/engine";
import { type Score, winPercentFor } from "@/lib/engine/score";
import { classifyMove } from "@/lib/review/classify";
import { explainMove } from "@/lib/review/explain";
import { isSacrifice } from "@/lib/review/sacrifice";
import type { MoveClass, MoveExplanation } from "@/lib/review/types";

/** Coach feedback for one move played in Play mode. */
export interface CoachFeedback {
  classification: MoveClass;
  explanation: MoveExplanation;
  square: string;
  bestSan: string | null;
  evalAfter: Score;
}

/**
 * Grade a move with the same rules as the full game review, from two
 * full-strength engine snapshots (before: MultiPV, after: reply line).
 */
export function gradeMove(fenBefore: string, uci: string, before: AnalysisSnapshot, after: AnalysisSnapshot): CoachFeedback | null {
  const step = playLine(fenBefore, [uci], 1)[0];
  if (!step || before.lines.length === 0) return null;
  const mover = step.move.color as Color;
  const chess = new Chess(step.fen);
  const deliversMate = chess.isCheckmate();
  const evalBefore = before.lines[0].score;
  let evalAfter: Score = after.lines[0]?.score ?? { kind: "cp", value: 0 };
  if (deliversMate) evalAfter = { kind: "mate", value: mover === "w" ? 1 : -1 };
  else if (chess.isDraw() || chess.isStalemate()) evalAfter = { kind: "cp", value: 0 };
  const replyLine = after.lines[0]?.pv ?? [];
  const result = classifyMove({
    mover,
    playedUci: uci,
    evalBefore,
    evalAfter,
    linesBefore: before.lines,
    legalMoveCount: new Chess(fenBefore).moves().length,
    isBook: false,
    deliversMate,
    isSacrifice: !deliversMate && isSacrifice(fenBefore, uci, replyLine),
  });
  const bestLine = before.lines[0].pv;
  const explanation = explainMove({
    mover,
    classification: result.classification,
    fenBefore,
    fenAfter: step.fen,
    playedSan: step.move.san,
    playedUci: uci,
    evalBefore,
    evalAfter,
    bestLine,
    replyLine,
    deliversMate,
  });
  const bestSan = playLine(fenBefore, bestLine, 1)[0]?.move.san ?? null;
  return { classification: result.classification, explanation, square: step.move.to, bestSan, evalAfter };
}

/** FEN with the side to move swapped ("null move"), or null if illegal (side to move in check). */
export function nullMoveFen(fen: string): string | null {
  const parts = fen.split(" ");
  const chess = new Chess(fen);
  if (chess.inCheck()) return null;
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  const swapped = parts.join(" ");
  try {
    const c = new Chess(swapped);
    // The opponent must not be able to capture our king immediately.
    return c.inCheck() ? null : swapped;
  } catch {
    return null;
  }
}

export interface Threat {
  from: string;
  to: string;
  san: string;
  text: string;
}

/**
 * The opponent's threat: their best move if they could move again now,
 * reported only when it would gain ≥ 10 win% for them (a real threat).
 */
export function findThreat(fen: string, me: Color, current: AnalysisSnapshot, nullMove: AnalysisSnapshot): Threat | null {
  const nmFen = nullMoveFen(fen);
  const best = nullMove.lines[0];
  const now = current.lines[0];
  if (!nmFen || !best?.pv[0] || !now) return null;
  const gain = winPercentFor(now.score, me) - winPercentFor(best.score, me);
  if (gain < 10) return null;
  const step = playLine(nmFen, [best.pv[0]], 1)[0];
  const p = parseUci(best.pv[0]);
  if (!step || !p) return null;
  let text: string;
  if (best.score.kind === "mate" && winPercentFor(best.score, me) === 0) text = `Your opponent threatens checkmate with ${step.move.san}.`;
  else if (step.move.captured) text = `Your ${PIECE_NAME[step.move.captured as PieceSymbol]} on ${step.move.to} is under threat (${step.move.san}).`;
  else text = `Watch out for ${step.move.san}.`;
  return { from: p.from, to: p.to, san: step.move.san, text };
}

/** Hint stage 1: name the piece that should move, without giving the move away. */
export function pieceHint(fen: string, bestUci: string): { square: string; text: string } | null {
  const p = parseUci(bestUci);
  if (!p) return null;
  const piece = new Chess(fen).get(p.from);
  if (!piece) return null;
  return { square: p.from, text: `Look for a good move with your ${PIECE_NAME[piece.type as PieceSymbol]} on ${p.from}.` };
}
