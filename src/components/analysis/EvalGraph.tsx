"use client";

import { useMemo } from "react";
import { winPercent } from "@/lib/engine/score";
import type { GameReview } from "@/lib/review/types";
import { formatClock } from "@/lib/review/time";
import { moveClassColor } from "./MoveClassBadge";

const W = 600;
const H = 120;

/**
 * Win-probability chart (White's perspective) with key moments marked.
 * Clicking jumps to that ply. A second band shows time spent per move when
 * the PGN contained clock data.
 */
export function EvalGraph({ review, currentPly, onSelect }: { review: GameReview; currentPly: number; onSelect: (ply: number) => void }) {
  const points = useMemo(
    () =>
      review.positions.map((p, i) => {
        let w: number;
        if (p.terminal === "checkmate") w = p.fen.split(" ")[1] === "w" ? 0 : 100;
        else if (p.terminal) w = 50;
        else w = winPercent(p.score);
        return { ply: i, w };
      }),
    [review.positions],
  );
  const n = Math.max(1, points.length - 1);
  const x = (ply: number) => (ply / n) * W;
  const y = (w: number) => H - (w / 100) * H;
  const area = `M0,${H} ${points.map((p) => `L${x(p.ply).toFixed(1)},${y(p.w).toFixed(1)}`).join(" ")} L${W},${H} Z`;

  const timed = review.moves.filter((m) => m.timeSpentSeconds !== undefined);
  const maxSpent = Math.max(1, ...timed.map((m) => m.timeSpentSeconds ?? 0));

  const errors = review.moves.filter((m) => ["mistake", "blunder", "missed-win"].includes(m.classification));

  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-28 w-full cursor-pointer rounded-md border border-border"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evaluation over the game. Upper area means White is better."
        onClick={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const ply = Math.round(((e.clientX - rect.left) / rect.width) * n);
          onSelect(Math.max(0, Math.min(n, ply)));
        }}
      >
        <rect width={W} height={H} fill="var(--eval-black)" />
        <path d={area} fill="var(--eval-white)" />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--ink-3)" strokeDasharray="4 4" strokeWidth={0.75} opacity={0.6} />
        {errors.map((m) => (
          <circle key={m.ply} cx={x(m.ply)} cy={y(points[m.ply]?.w ?? 50)} r={4} fill={moveClassColor(m.classification)} stroke="var(--surface)" strokeWidth={1.5}>
            <title>{`${m.san}: ${m.classification}`}</title>
          </circle>
        ))}
        <line x1={x(currentPly)} x2={x(currentPly)} y1={0} y2={H} stroke="var(--accent)" strokeWidth={2} />
      </svg>
      {timed.length > 0 ? (
        <div>
          <svg viewBox={`0 0 ${W} 40`} className="h-10 w-full" preserveAspectRatio="none" role="img" aria-label="Time spent per move. White above the line, Black below.">
            <line x1={0} x2={W} y1={20} y2={20} stroke="var(--border)" />
            {timed.map((m) => {
              const h = ((m.timeSpentSeconds ?? 0) / maxSpent) * 18;
              return (
                <rect
                  key={m.ply}
                  x={x(m.ply) - 1.5}
                  width={3}
                  y={m.color === "w" ? 20 - h : 20}
                  height={Math.max(0.5, h)}
                  fill={m.underTimePressure ? "var(--bad)" : m.color === "w" ? "var(--ink-3)" : "var(--accent)"}
                >
                  <title>{`${m.san}: ${formatClock(m.timeSpentSeconds)} spent, ${formatClock(m.clockSeconds)} left`}</title>
                </rect>
              );
            })}
          </svg>
          <figcaption className="flex flex-wrap gap-x-4 text-[11px] text-ink-3">
            <span>Time per move — grey: White, brass: Black</span>
            <span className="text-bad">red: under time pressure</span>
          </figcaption>
        </div>
      ) : null}
    </figure>
  );
}
