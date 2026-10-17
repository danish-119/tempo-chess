"use client";

import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Board, type BoardArrow } from "@/components/board/Board";
import { StepControls } from "@/components/board/StepControls";
import { useSound } from "@/hooks/useSound";

export interface LinePly {
  san: string;
  uci: string;
  from: string;
  to: string;
  fenAfter: string;
}

/** Play out SAN moves (space separated) from `startFen`. Throws on an illegal move. */
export function buildLine(startFen: string, sans: string[]): LinePly[] {
  const c = new Chess(startFen);
  return sans.map((san) => {
    const m = c.move(san);
    return { san: m.san, uci: m.from + m.to + (m.promotion ?? ""), from: m.from, to: m.to, fenAfter: c.fen() };
  });
}

/** Same as buildLine, for UCI moves ("e2e4", "e7e8q"). */
export function buildUciLine(startFen: string, ucis: string[]): LinePly[] {
  const c = new Chess(startFen);
  return ucis.map((u) => {
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    return { san: m.san, uci: u, from: m.from, to: m.to, fenAfter: c.fen() };
  });
}

/**
 * A board that steps through a fixed line: ⏮ ◀ ▶ ⏭, keyboard arrows, and
 * autoplay at 1–3 seconds per move. `ply` is controlled by the parent.
 */
export function LineViewer({
  startFen,
  line,
  ply,
  setPly,
  orientation,
  arrows,
  interactive = false,
  onMove,
  ariaLabel,
}: {
  startFen: string;
  line: LinePly[];
  ply: number;
  setPly: (n: number) => void;
  orientation: "white" | "black";
  arrows?: BoardArrow[];
  interactive?: boolean;
  onMove?: (uci: string) => boolean;
  ariaLabel: string;
}) {
  const sound = useSound();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const fen = ply === 0 ? startFen : line[ply - 1].fenAfter;
  const last = ply > 0 ? { from: line[ply - 1].from, to: line[ply - 1].to } : null;

  const go = (n: number, withSound = false) => {
    const next = Math.max(0, Math.min(line.length, n));
    if (withSound && next === ply + 1) sound.playSan(line[next - 1].san);
    setPly(next);
  };

  useEffect(() => {
    if (!playing) return;
    if (ply >= line.length) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      sound.playSan(line[ply].san);
      setPly(ply + 1);
    }, speed * 1000);
    return () => clearTimeout(t);
  }, [playing, ply, line, speed, setPly, sound]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (interactive) return;
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
        return;
      }
      const map: Record<string, number> = { ArrowLeft: ply - 1, ArrowRight: ply + 1, Home: 0, End: line.length };
      if (e.key in map) {
        e.preventDefault();
        setPlaying(false);
        go(map[e.key], e.key === "ArrowRight");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-2">
      <Board fen={fen} orientation={orientation} lastMove={last} arrows={arrows} interactive={interactive} onMove={onMove} ariaLabel={ariaLabel} />
      {!interactive ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StepControls
            onFirst={() => { setPlaying(false); go(0); }}
            onPrev={() => { setPlaying(false); go(ply - 1); }}
            onNext={() => { setPlaying(false); go(ply + 1, true); }}
            onLast={() => { setPlaying(false); go(line.length); }}
            canPrev={ply > 0}
            canNext={ply < line.length}
            playing={playing}
            onTogglePlay={() => { if (!playing && ply >= line.length) setPly(0); setPlaying((p) => !p); }}
            speed={speed}
            onSpeed={setSpeed}
          />
          <p className="text-xs text-ink-3 tabular" aria-live="polite">{ply === 0 ? "Start" : `${line[ply - 1].san} · ${ply}/${line.length}`}</p>
        </div>
      ) : null}
    </div>
  );

}
