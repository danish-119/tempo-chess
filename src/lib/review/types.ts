import type { Color } from "@/lib/chess/types";
import type { EngineLine } from "@/lib/engine/engine";
import type { Score } from "@/lib/engine/score";

/**
 * Tempo's own move categories. These are an approximation based on
 * win-probability loss.
 */
export type MoveClass =
  | "brilliant"
  | "book"
  | "forced"
  | "only"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "missed-win";

export type GamePhase = "opening" | "middlegame" | "endgame";

export interface PositionEval {
  fen: string;
  /** Engine lines (White POV). Empty for terminal positions. */
  lines: EngineLine[];
  /** Best evaluation (White POV). For terminal positions, a synthetic score. */
  score: Score;
  depth: number;
  terminal: "checkmate" | "stalemate" | "draw" | null;
  bestmove: string | null;
}

export type MotifTag =
  | "mate-threat"
  | "allows-mate"
  | "missed-mate"
  | "back-rank"
  | "hanging-piece"
  | "fork"
  | "pin"
  | "promotion"
  | "material-loss"
  | "missed-material"
  | "trade-down";

export interface MoveExplanation {
  /** One-sentence summary, safe to display as plain text. */
  text: string;
  motifs: MotifTag[];
  /** True when the explanation is backed by a concrete verified line. */
  verified: boolean;
}

export interface MoveReview {
  ply: number;
  moveNumber: number;
  color: Color;
  san: string;
  uci: string;
  classification: MoveClass;
  /** Evaluation (White POV) of the best play before the move. */
  evalBefore: Score;
  /** Evaluation (White POV) after the move was played. */
  evalAfter: Score;
  /** Mover's win% before (with best play) and after the move. */
  winBefore: number;
  winAfter: number;
  /** Win% lost by the mover (0..100), the basis of the classification. */
  winLoss: number;
  /** Per-move accuracy (0..100), see accuracy.ts. */
  accuracy: number;
  bestMoveUci: string | null;
  bestMoveSan: string | null;
  /** Best line from the position before the move (SAN). */
  bestLineSan: string[];
  /** Engine's continuation after the played move (SAN). */
  replyLineSan: string[];
  explanation: MoveExplanation;
  phase: GamePhase;
  timeSpentSeconds?: number;
  clockSeconds?: number;
  underTimePressure: boolean;
  /** True if this is one of the game's turning points. */
  keyMoment: boolean;
}

export interface PlayerSummary {
  accuracy: number | null;
  counts: Record<MoveClass, number>;
  phaseAccuracy: Record<GamePhase, number | null>;
  averageWinLoss: number;
  movesAnalyzed: number;
  timePressureErrors: number;
}

export interface ReviewSettings {
  preset: "quick" | "standard" | "deep";
  depth: number;
  /** Optional time cap per position in ms (0 = depth only). */
  movetimeMs: number;
  multiPv: number;
}

/** Bump when classification/explanation rules change. */
export const REVIEW_VERSION = 2;

export interface GameReview {
  gameId: string;
  /** Classification-rules version; older reviews are rebuilt from `positions`. */
  version: number;
  settings: ReviewSettings;
  engineName: string;
  createdAt: number;
  positions: PositionEval[];
  moves: MoveReview[];
  white: PlayerSummary;
  black: PlayerSummary;
  opening: { eco: string; name: string; bookPlies: number } | null;
  keyMomentPlies: number[];
}

export const MOVE_CLASS_LABEL: Record<MoveClass, string> = {
  brilliant: "Brilliant",
  book: "Book",
  forced: "Forced",
  only: "Great",
  best: "Best",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
  "missed-win": "Miss",
};

/** Display order (matches the familiar order used by popular review tools). */
export const MOVE_CLASS_ORDER: MoveClass[] = [
  "brilliant",
  "only",
  "best",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "missed-win",
  "blunder",
  "forced",
];

/** How the coach phrases a classification: "Nf6 is a blunder". */
export const MOVE_CLASS_PHRASE: Record<MoveClass, string> = {
  brilliant: "is brilliant",
  only: "is a great move",
  best: "is best",
  excellent: "is excellent",
  good: "is good",
  book: "is a book move",
  inaccuracy: "is an inaccuracy",
  mistake: "is a mistake",
  "missed-win": "is a miss",
  blunder: "is a blunder",
  forced: "is forced",
};

export function isError(c: MoveClass): boolean {
  return c === "inaccuracy" || c === "mistake" || c === "blunder" || c === "missed-win";
}

export function emptyCounts(): Record<MoveClass, number> {
  return {
    brilliant: 0,
    book: 0,
    forced: 0,
    only: 0,
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    "missed-win": 0,
  };
}
