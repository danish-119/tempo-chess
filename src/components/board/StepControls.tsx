"use client";

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { IconButton } from "@/components/ui/primitives";

export const STEP_SPEEDS = [0.5, 1, 2, 3];

/** ⏮ ◀ ▶ ⏭ + play/pause + speed — the same controls as the review board. */
export function StepControls({
  onFirst,
  onPrev,
  onNext,
  onLast,
  playing,
  onTogglePlay,
  speed,
  onSpeed,
  canPrev = true,
  canNext = true,
}: {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  playing: boolean;
  onTogglePlay: () => void;
  /** Seconds per move. */
  speed: number;
  onSpeed: (s: number) => void;
  canPrev?: boolean;
  canNext?: boolean;
}) {
  return (
    <div className="flex items-center" role="group" aria-label="Move navigation">
      <IconButton label="First move (Home)" onClick={onFirst} disabled={!canPrev}>
        <ChevronFirst className="size-5" aria-hidden />
      </IconButton>
      <IconButton label="Previous move (←)" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="size-5" aria-hidden />
      </IconButton>
      <IconButton label="Next move (→)" onClick={onNext} disabled={!canNext}>
        <ChevronRight className="size-5" aria-hidden />
      </IconButton>
      <IconButton label="Last move (End)" onClick={onLast} disabled={!canNext}>
        <ChevronLast className="size-5" aria-hidden />
      </IconButton>
      <IconButton
        label={playing ? "Pause autoplay (Space)" : "Autoplay (Space)"}
        onClick={onTogglePlay}
        aria-pressed={playing}
        className={playing ? "bg-accent-soft text-accent" : undefined}
      >
        {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
      </IconButton>
      <select
        value={speed}
        onChange={(e) => onSpeed(Number(e.target.value))}
        aria-label="Autoplay speed"
        className="h-8 rounded-md border border-border bg-surface px-1 text-xs text-ink-2"
      >
        {STEP_SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}s
          </option>
        ))}
      </select>
    </div>
  );
}
