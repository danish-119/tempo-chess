"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import type { PlyRecord } from "@/lib/chess/types";
import type { Variation } from "@/lib/chess/navigation";
import type { MoveReview } from "@/lib/review/types";
import { cx } from "@/components/ui/primitives";
import { MoveClassIcon, moveClassNag } from "./MoveClassBadge";

interface Props {
  moves: PlyRecord[];
  reviews?: MoveReview[];
  currentPly: number;
  variation: Variation | null;
  onSelect: (ply: number) => void;
  onSelectVariation: (index: number) => void;
  onExitVariation: () => void;
  /** Plies to show when filtering (null = all). */
  visiblePlies?: Set<number> | null;
  /** Use an internal scroll area (false when the parent already scrolls). */
  scroll?: boolean;
}

function MoveListInner({ moves, reviews, currentPly, variation, onSelect, onSelectVariation, onExitVariation, visiblePlies, scroll = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activePly = variation ? variation.basePly : currentPly;

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-ply="${activePly}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activePly]);

  const rows = useMemo(() => {
    const out: { number: number; white?: PlyRecord; black?: PlyRecord }[] = [];
    for (const m of moves) {
      if (m.color === "w" || out.length === 0) out.push({ number: m.moveNumber, white: m.color === "w" ? m : undefined, black: m.color === "b" ? m : undefined });
      else out[out.length - 1].black = m;
    }
    return out;
  }, [moves]);

  if (moves.length === 0) {
    return <p className="p-4 text-sm text-ink-3">No moves yet.</p>;
  }

  const cell = (m: PlyRecord | undefined) => {
    if (!m) return <span className="px-2 text-ink-3">…</span>;
    if (visiblePlies && !visiblePlies.has(m.ply)) return <span className="px-2 text-ink-3/50">{m.san}</span>;
    const r = reviews?.[m.ply - 1];
    const active = !variation && m.ply === currentPly;
    const nag = r ? moveClassNag(r.classification) : undefined;
    return (
      <button
        type="button"
        data-ply={m.ply}
        onClick={() => onSelect(m.ply)}
        aria-current={active ? "step" : undefined}
        aria-label={`${m.moveNumber}${m.color === "w" ? "." : "..."} ${m.san}${r ? `, ${r.classification}` : ""}`}
        className={cx(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left font-mono text-sm transition-colors",
          active ? "bg-accent text-accent-ink" : "hover:bg-surface-2",
          r?.keyMoment && !active && "font-semibold",
        )}
      >
        {r ? <MoveClassIcon classification={r.classification} className={cx("size-3.5", active && "!text-accent-ink")} /> : null}
        <span>{m.san}</span>
        {nag ? <span className={cx("text-xs", active ? "text-accent-ink" : "text-ink-3")}>{nag}</span> : null}
      </button>
    );
  };

  return (
    <div ref={containerRef} className={cx(scroll && "max-h-[22rem] overflow-y-auto overscroll-contain lg:max-h-[26rem]")} aria-label="Moves">
      <ol className="divide-y divide-border/60">
        {rows.map((row) => (
          <li key={`${row.number}-${row.white?.ply ?? row.black?.ply}`}>
            <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-1 px-2 py-0.5">
              <span className="text-right text-xs text-ink-3 tabular">{row.number}.</span>
              {cell(row.white)}
              {cell(row.black)}
            </div>
            {variation && (variation.basePly === row.white?.ply || variation.basePly === row.black?.ply || (variation.basePly === 0 && row === rows[0])) ? (
              <VariationRow variation={variation} onSelect={onSelectVariation} onExit={onExitVariation} />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function VariationRow({ variation, onSelect, onExit }: { variation: Variation; onSelect: (i: number) => void; onExit: () => void }) {
  return (
    <div className="mx-2 mb-1 rounded-md border border-dashed border-info/50 bg-info-soft/50 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-info">Variation</span>
        <button type="button" onClick={onExit} className="text-xs font-medium text-info hover:underline">
          Back to game
        </button>
      </div>
      <div className="flex flex-wrap gap-0.5 font-mono text-sm">
        {variation.moves.map((m, i) => (
          <button
            key={`${i}-${m.uci}`}
            type="button"
            onClick={() => onSelect(i + 1)}
            aria-current={variation.index === i + 1 ? "step" : undefined}
            className={cx("rounded px-1.5 py-0.5", variation.index === i + 1 ? "bg-info text-white" : "hover:bg-surface-2")}
          >
            {m.san}
          </button>
        ))}
      </div>
    </div>
  );
}

export const MoveList = memo(MoveListInner);
