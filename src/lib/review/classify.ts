import type { Color } from "@/lib/chess/types";
import type { EngineLine } from "@/lib/engine/engine";
import { type Score, winPercentFor } from "@/lib/engine/score";
import type { MoveClass } from "./types";

/**
 * Tempo move classification
 * -------------------------
 * Every quantity is computed from the mover's point of view, using win
 * probability (see `winPercent` in score.ts) rather than raw centipawns, so
 * that a 2-pawn drop at +8 is treated as harmless while the same drop at
 * +0.5 is serious.
 *
 *   winBefore = mover's win% with the engine's best move from the position
 *   winAfter  = mover's win% after the move actually played
 *   winLoss   = max(0, winBefore − winAfter)
 *
 * Thresholds on winLoss (percentage points):
 *   played == engine best            → best   (or "only" — see below)
 *   < 2                              → excellent
 *   < 5                              → good
 *   < 10                             → inaccuracy
 *   < 20                             → mistake
 *   ≥ 20                             → blunder
 *
 * These bands follow the publicly documented expected-points ranges
 * (excellent ≤ 0.02, good ≤ 0.05, inaccuracy ≤ 0.10, mistake ≤ 0.20,
 * blunder > 0.20), expressed in win-percentage points.
 *
 * Special cases, checked first:
 *   - exactly one legal move                       → forced
 *   - opening-book position (policy in openings/)  → book
 *   - the game-ending checkmate                    → best
 *   - winBefore ≥ 75 and winAfter ≤ 55 and the drop
 *     would otherwise be ≥ mistake                  → missed-win
 *   - a verified sacrifice (see sacrifice.ts) of >= 2 points that
 *     loses < 2 win%, leaves the mover at >= 50% and was played
 *     when the mover was not already completely winning
 *     (best alternative < 90%)                    -> brilliant
 *   - played the engine's top move while the second
 *     choice is ≥ 15 points worse and the mover was
 *     not already lost (winBefore ≥ 25)            → only
 *
 * These thresholds are Tempo's own; they resemble publicly documented
 * approaches (e.g. Lichess's win-chance based annotations) but are not
 * identical to any other site.
 */
export const THRESHOLDS = {
  excellent: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 20,
  missedWinBefore: 75,
  missedWinAfter: 55,
  onlyMoveGap: 15,
  onlyMoveMinWin: 25,
  brilliantMaxLoss: 2,
  brilliantMinAfter: 50,
  brilliantMaxAlternative: 90,
} as const;

export interface ClassifyInput {
  mover: Color;
  playedUci: string;
  /** Best evaluation of the position before the move (White POV). */
  evalBefore: Score;
  /** Evaluation after the played move (White POV). */
  evalAfter: Score;
  /** Engine lines from the position before the move (MultiPV, White POV). */
  linesBefore: EngineLine[];
  legalMoveCount: number;
  isBook: boolean;
  /** The played move ends the game by checkmate. */
  deliversMate: boolean;
  /** The played move is a verified material sacrifice (sacrifice.ts). */
  isSacrifice?: boolean;
}

export interface ClassifyResult {
  classification: MoveClass;
  winBefore: number;
  winAfter: number;
  winLoss: number;
}

export function classifyMove(input: ClassifyInput): ClassifyResult {
  const { mover, playedUci, evalBefore, evalAfter, linesBefore } = input;
  const winBefore = winPercentFor(evalBefore, mover);
  const winAfter = input.deliversMate ? 100 : winPercentFor(evalAfter, mover);
  const bestUci = linesBefore[0]?.pv[0] ?? null;
  const playedBest = bestUci !== null && bestUci === playedUci;
  // If the engine's own top move is played, any apparent loss is search noise.
  const winLoss = playedBest || input.deliversMate ? 0 : Math.max(0, winBefore - winAfter);
  const base = { winBefore, winAfter, winLoss };

  if (input.legalMoveCount === 1) return { ...base, classification: "forced" };
  if (input.deliversMate) return { ...base, classification: "best" };
  if (input.isBook) return { ...base, classification: "book" };

  if (input.isSacrifice && winLoss < THRESHOLDS.brilliantMaxLoss && winAfter >= THRESHOLDS.brilliantMinAfter) {
    // "Already completely winning" is judged by the best alternative to the
    // played move, so finding the only winning sacrifice still counts.
    const alternative = linesBefore.find((l) => l.pv[0] && l.pv[0] !== playedUci);
    const altWin = alternative ? winPercentFor(alternative.score, mover) : winBefore;
    if (altWin < THRESHOLDS.brilliantMaxAlternative) return { ...base, classification: "brilliant" };
  }

  if (playedBest) {
    const second = linesBefore[1];
    if (second && winBefore >= THRESHOLDS.onlyMoveMinWin) {
      const gap = winBefore - winPercentFor(second.score, mover);
      if (gap >= THRESHOLDS.onlyMoveGap) return { ...base, classification: "only" };
    }
    return { ...base, classification: "best" };
  }

  if (
    winLoss >= THRESHOLDS.inaccuracy &&
    winBefore >= THRESHOLDS.missedWinBefore &&
    winAfter <= THRESHOLDS.missedWinAfter
  ) {
    return { ...base, classification: "missed-win" };
  }

  let classification: MoveClass;
  if (winLoss < THRESHOLDS.excellent) classification = "excellent";
  else if (winLoss < THRESHOLDS.good) classification = "good";
  else if (winLoss < THRESHOLDS.inaccuracy) classification = "inaccuracy";
  else if (winLoss < THRESHOLDS.mistake) classification = "mistake";
  else classification = "blunder";
  return { ...base, classification };
}
