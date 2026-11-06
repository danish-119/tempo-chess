import { START_FEN } from "@/lib/chess/types";
import type { Score } from "@/lib/engine/score";
import type { MoveClass } from "@/lib/review/types";
import raw from "./opera-review.json";

/**
 * A real review of the Opera Game: every evaluation, grade and sentence in this file was produced by Tempo's own
 * review pipeline running the real Stockfish build (see tests/integration/landing-fixture.test.ts). Nothing here
 * is hand-written, so the landing page shows what the product actually does.
 */
export type FixturePosition = { cp: number } | { mate: number };

export interface FixtureMove {
  ply: number;
  san: string;
  uci: string;
  /** Position after the move. */
  fen: string;
  cls: MoveClass;
  text: string;
  best: string | null;
}

export interface OperaReview {
  game: { title: string; white: string; black: string; where: string };
  engine: string;
  preset: string;
  depth: number;
  positions: FixturePosition[];
  moves: FixtureMove[];
  accuracy: { white: number; black: number };
}

export const OPERA = raw as unknown as OperaReview;
export const OPERA_PLIES = OPERA.moves.length;

/** Position after `ply` half-moves (0 = the start position). */
export function operaFen(ply: number): string {
  return ply <= 0 ? START_FEN : OPERA.moves[Math.min(ply, OPERA_PLIES) - 1].fen;
}

export function operaScore(ply: number): Score {
  const p = OPERA.positions[Math.max(0, Math.min(ply, OPERA_PLIES))];
  return "cp" in p ? { kind: "cp", value: p.cp } : { kind: "mate", value: p.mate };
}

/** "17. Rd8#" or "6… Nf6" for the move that led to `ply`. */
export function operaLabel(ply: number): string {
  if (ply <= 0) return "Start position";
  const m = OPERA.moves[ply - 1];
  return `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "…"} ${m.san}`;
}

/** The moments the Review scene stops at, chosen from the real grades: the memorable errors and the brilliant moves. */
export const KEY_PLIES: number[] = OPERA.moves
  .filter((m) => m.cls === "brilliant" || m.cls === "mistake" || m.cls === "blunder" || m.ply === OPERA_PLIES)
  .map((m) => m.ply);
