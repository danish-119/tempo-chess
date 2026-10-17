/**
 * Tempo accuracy
 * --------------
 * Per-move accuracy uses the exponential curve published by Lichess
 * (lichess.org/page/accuracy):
 *
 *   moveAccuracy = 103.1668 × exp(−0.04354 × winLoss) − 3.1669   (clamped 0..100)
 *
 * where winLoss is the mover's win-percentage drop (0..100).
 *
 * Game accuracy for a player is the average of the arithmetic mean and the
 * harmonic mean of their move accuracies. The harmonic mean punishes a few
 * severe errors more than a plain average would. Forced moves are excluded.
 *
 * This is an approximation designed for Tempo; it will not exactly match
 * other sites' values (Lichess, for example, uses volatility-weighted windows).
 */
export function moveAccuracy(winLoss: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669;
  return Math.min(100, Math.max(0, raw));
}

export function gameAccuracy(moveAccuracies: number[]): number | null {
  if (moveAccuracies.length === 0) return null;
  const mean = moveAccuracies.reduce((a, b) => a + b, 0) / moveAccuracies.length;
  // Harmonic mean with a floor to avoid division by zero for 0% moves.
  const harmonic = moveAccuracies.length / moveAccuracies.reduce((a, b) => a + 1 / Math.max(b, 1), 0);
  return Math.round(((mean + harmonic) / 2) * 10) / 10;
}
