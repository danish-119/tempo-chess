import type { Color } from "@/lib/chess/types";

/**
 * An engine score. `cp` is centipawns, `mate` is moves-to-mate (positive =
 * the side the score is relative to delivers mate). Scores are ALWAYS stored
 * from White's point of view once they leave the UCI parser — see
 * `toWhitePov` — so comparisons never depend on whose turn it is.
 */
export type Score = { kind: "cp"; value: number } | { kind: "mate"; value: number };

/** UCI reports scores from the side to move; convert to White's perspective. */
export function toWhitePov(score: Score, sideToMove: Color): Score {
  if (sideToMove === "w") return score;
  return { kind: score.kind, value: -score.value } as Score;
}

/** Re-express a White-POV score from the given player's point of view. */
export function forPlayer(score: Score, player: Color): Score {
  return player === "w" ? score : ({ kind: score.kind, value: -score.value } as Score);
}

/**
 * Win probability in [0, 100] for White, from a White-POV score.
 * Logistic model publicly documented by Lichess (lichess.org/page/accuracy):
 *   Win% = 50 + 50 × (2 / (1 + exp(-0.00368208 × cp)) − 1)
 * Mate scores map to 100 / 0, except "mate in 0" which is game over.
 */
export function winPercent(score: Score): number {
  if (score.kind === "mate") {
    if (score.value === 0) return 50; // should be handled as terminal by caller
    return score.value > 0 ? 100 : 0;
  }
  const cp = Math.max(-1000, Math.min(1000, score.value));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Win% from a given player's point of view. */
export function winPercentFor(score: Score, player: Color): number {
  const w = winPercent(score);
  return player === "w" ? w : 100 - w;
}

/** Map a score to a sortable number (mates dominate any centipawn value). */
export function scoreToOrdinal(score: Score): number {
  if (score.kind === "cp") return score.value;
  if (score.value === 0) return 0;
  const sign = Math.sign(score.value);
  return sign * (100000 - Math.abs(score.value));
}

/** Human-readable score, e.g. "+1.24", "−0.50", "M3", "−M5". White POV. */
export function formatScore(score: Score): string {
  if (score.kind === "mate") {
    if (score.value === 0) return "#";
    return score.value > 0 ? `M${score.value}` : `−M${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  if (Math.abs(pawns) < 0.005) return "0.00";
  return `${pawns > 0 ? "+" : "−"}${Math.abs(pawns).toFixed(2)}`;
}

/**
 * Fraction of the evaluation bar (0..1) filled for White. Uses the win%
 * curve so the bar stays readable for huge evaluations.
 */
export function evalBarFraction(score: Score | null): number {
  if (!score) return 0.5;
  if (score.kind === "mate") {
    if (score.value === 0) return 0.5;
    return score.value > 0 ? 1 : 0;
  }
  return Math.min(0.98, Math.max(0.02, winPercent(score) / 100));
}

export function scoresEqual(a: Score | null | undefined, b: Score | null | undefined): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.value === b.value;
}
