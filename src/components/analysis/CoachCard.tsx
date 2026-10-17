"use client";

import { ChevronLeft, ChevronRight, Eye, RotateCcw } from "lucide-react";
import { formatScore } from "@/lib/engine/score";
import { MOVE_CLASS_PHRASE, type MoveReview, isError } from "@/lib/review/types";
import { Button } from "@/components/ui/primitives";
import { MoveClassIcon, moveClassColor } from "./MoveClassBadge";

/**
 * The focused "coach" view of the current move: what it was, why, and what
 * was better — plus quick navigation between key moments.
 */
export function CoachCard({
  move,
  onShowBest,
  onRetry,
  onPrevKey,
  onNextKey,
  hasPrevKey,
  hasNextKey,
}: {
  move: MoveReview | null;
  onShowBest: () => void;
  onRetry: () => void;
  onPrevKey: () => void;
  onNextKey: () => void;
  hasPrevKey: boolean;
  hasNextKey: boolean;
}) {
  return (
    <div className="space-y-3" aria-live="polite">
      {move ? (
        <div className="rounded-xl border p-3" style={{ borderColor: `color-mix(in srgb, ${moveClassColor(move.classification)} 45%, transparent)`, background: `color-mix(in srgb, ${moveClassColor(move.classification)} 7%, transparent)` }}>
          <div className="flex items-center gap-2">
            <MoveClassIcon classification={move.classification} className="size-6" />
            <p className="text-base font-semibold">
              <span className="font-mono">
                {move.moveNumber}
                {move.color === "w" ? "." : "…"} {move.san}
              </span>{" "}
              <span style={{ color: moveClassColor(move.classification) }}>{MOVE_CLASS_PHRASE[move.classification]}</span>
            </p>
            <span className="ml-auto font-mono text-sm text-ink-2 tabular" title="Evaluation after the move (White's view)">
              {formatScore(move.evalAfter)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{move.explanation.text}</p>
          {(move.bestMoveSan && move.bestMoveUci !== move.uci) || isError(move.classification) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {move.bestMoveSan && move.bestMoveUci !== move.uci ? (
                <Button size="sm" onClick={onShowBest}>
                  <Eye className="size-4" aria-hidden /> Best: <span className="font-mono">{move.bestMoveSan}</span>
                </Button>
              ) : null}
              {isError(move.classification) ? (
                <Button size="sm" variant="primary" onClick={onRetry}>
                  <RotateCcw className="size-4" aria-hidden /> Retry
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={onPrevKey} disabled={!hasPrevKey}>
          <ChevronLeft className="size-4" aria-hidden /> Previous key moment
        </Button>
        <Button size="sm" className="flex-1" onClick={onNextKey} disabled={!hasNextKey}>
          Next key moment <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
