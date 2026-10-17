import { countMaterial } from "@/lib/chess/material";
import type { GamePhase } from "./types";

/**
 * Phase detection (Tempo heuristic):
 *   - endgame: at most 6 non-pawn, non-king pieces remain on the board, or
 *     both queens are gone and at most 8 such pieces remain;
 *   - opening: while still in the opening book, or within the first 12 full
 *     moves while at least 12 non-pawn pieces remain;
 *   - middlegame otherwise.
 * Once the endgame is reached it never reverts.
 */
export function detectPhases(fensBeforeMoves: string[], bookPlies: number): GamePhase[] {
  const phases: GamePhase[] = [];
  let reachedEndgame = false;
  let leftOpening = false;
  fensBeforeMoves.forEach((fen, idx) => {
    const m = countMaterial(fen);
    const queens = m.pieces.w.q + m.pieces.b.q;
    if (!reachedEndgame && (m.minorMajorPieces <= 6 || (queens === 0 && m.minorMajorPieces <= 8))) {
      reachedEndgame = true;
    }
    if (reachedEndgame) {
      phases.push("endgame");
      return;
    }
    const ply = idx + 1;
    const inOpening = ply <= bookPlies || (ply <= 24 && m.minorMajorPieces >= 12);
    if (!leftOpening && inOpening) {
      phases.push("opening");
      return;
    }
    leftOpening = true;
    phases.push("middlegame");
  });
  return phases;
}
