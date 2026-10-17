"use client";

import { type Score, evalBarFraction, formatScore } from "@/lib/engine/score";

/**
 * Vertical evaluation bar. Always shows White's perspective: the light part
 * is White's share. The fill follows the win-probability curve so large
 * evaluations stay readable.
 */
export function EvalBar({
  score,
  orientation,
  terminal,
}: {
  score: Score | null;
  orientation: "white" | "black";
  /** For finished positions: who won ("w"/"b") or "draw". */
  terminal?: "w" | "b" | "draw" | null;
}) {
  let whiteFraction = evalBarFraction(score);
  if (terminal === "w") whiteFraction = 1;
  else if (terminal === "b") whiteFraction = 0;
  else if (terminal === "draw") whiteFraction = 0.5;

  const label =
    terminal === "w" ? "1-0" : terminal === "b" ? "0-1" : terminal === "draw" ? "½-½" : score ? formatScore(score) : "–";
  const whiteAhead = whiteFraction >= 0.5;
  const pct = `${(whiteFraction * 100).toFixed(1)}%`;
  const flipped = orientation === "black";

  return (
    <div
      className="relative w-6 shrink-0 self-stretch overflow-hidden rounded-md border border-border sm:w-7"
      style={{ background: "var(--eval-black)" }}
      role="meter"
      aria-label="Evaluation, from White's point of view"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(whiteFraction * 100)}
      aria-valuetext={`${label} (White's perspective)`}
    >
      <div
        className="absolute inset-x-0 transition-[height] duration-500 ease-out"
        style={{ background: "var(--eval-white)", height: pct, [flipped ? "top" : "bottom"]: 0 }}
      />
      <span
        className="absolute inset-x-0 text-center text-[10px] font-bold leading-none tabular sm:text-[11px]"
        style={{
          color: whiteAhead ? "var(--eval-black)" : "var(--eval-white)",
          [whiteAhead !== flipped ? "bottom" : "top"]: 4,
        }}
      >
        {label.replace("+", "").replace("−", "-")}
      </span>
    </div>
  );
}
