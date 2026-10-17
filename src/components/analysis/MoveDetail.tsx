"use client";

import { Eye, RotateCcw, ShieldCheck } from "lucide-react";
import { formatScore } from "@/lib/engine/score";
import { type MoveReview, isError } from "@/lib/review/types";
import { formatClock } from "@/lib/review/time";
import { Button } from "@/components/ui/primitives";
import { MoveClassBadge } from "./MoveClassBadge";

export function MoveDetail({
  move,
  onShowBest,
  onRetry,
}: {
  move: MoveReview;
  onShowBest: () => void;
  onRetry: () => void;
}) {
  const showBest = move.bestMoveSan && move.bestMoveUci !== move.uci;
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold">
          {move.moveNumber}
          {move.color === "w" ? "." : "…"} {move.san}
        </span>
        <MoveClassBadge classification={move.classification} />
        {move.underTimePressure ? (
          <span className="rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-medium text-bad">time pressure</span>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-ink">{move.explanation.text}</p>
      {move.explanation.verified && move.explanation.motifs.length > 0 ? (
        <p className="flex items-center gap-1 text-[11px] text-ink-3">
          <ShieldCheck className="size-3.5 text-good" aria-hidden /> Checked against the engine line.
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-ink-2 sm:grid-cols-4">
        <div>
          <dt className="text-ink-3">Before</dt>
          <dd className="font-mono tabular">{formatScore(move.evalBefore)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">After</dt>
          <dd className="font-mono tabular">{formatScore(move.evalAfter)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Win % lost</dt>
          <dd className="font-mono tabular">{move.winLoss.toFixed(1)}</dd>
        </div>
        {move.timeSpentSeconds !== undefined ? (
          <div>
            <dt className="text-ink-3">Time used</dt>
            <dd className="font-mono tabular">{formatClock(move.timeSpentSeconds)}</dd>
          </div>
        ) : null}
      </dl>
      {showBest ? (
        <p className="text-sm">
          <span className="text-ink-3">Best was </span>
          <span className="font-mono font-semibold">{move.bestMoveSan}</span>
          {move.bestLineSan.length > 1 ? <span className="font-mono text-xs text-ink-3"> ({move.bestLineSan.slice(0, 5).join(" ")}…)</span> : null}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {showBest ? (
          <Button size="sm" onClick={onShowBest}>
            <Eye className="size-4" aria-hidden /> Explore best line
          </Button>
        ) : null}
        {isError(move.classification) ? (
          <Button size="sm" variant="primary" onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden /> Retry this move
          </Button>
        ) : null}
      </div>
    </div>
  );
}
