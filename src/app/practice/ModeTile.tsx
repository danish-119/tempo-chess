"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * Whether a tile's little preview should be moving. On a mouse it plays while the tile is hovered or focused;
 * on a touch screen (nothing to hover) it plays all the time. Never with reduced motion.
 */
export function useAlive(engaged: boolean): boolean {
  const [calm, setCalm] = useState(true); // true until the browser has told us otherwise
  const [canHover, setCanHover] = useState(true);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hover = window.matchMedia("(hover: hover)");
    const sync = () => {
      setCalm(reduce.matches);
      setCanHover(hover.matches);
    };
    sync();
    reduce.addEventListener("change", sync);
    hover.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      hover.removeEventListener("change", sync);
    };
  }, []);
  return !calm && (engaged || !canHover);
}

/** A counter that ticks every `ms` while `on`, and rests at 0 otherwise. */
export function useTick(on: boolean, ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setN((v) => v + 1), ms);
    return () => window.clearInterval(id);
  }, [on, ms]);
  return on ? n : 0;
}

const SQUARES = ["e4", "a7", "h3", "c6", "f1", "d5", "b2", "g8"];
const MOVES = ["e4", "Nf3", "Bc4", "O-O", "Qh5"];

/** A tiny live picture of what each mode feels like. */
function Preview({ id, alive }: { id: string; alive: boolean }) {
  const t = useTick(alive, id === "rush" ? 1000 : id === "puzzles" ? 1100 : 1300);

  if (id === "puzzles") {
    // a knight that hops to the highlighted square
    const hopped = t % 2 === 1;
    return (
      <div className="relative size-[88px] overflow-hidden rounded-lg border border-border" aria-hidden>
        <div className="grid size-full grid-cols-4 grid-rows-4">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className={(Math.floor(i / 4) + i) % 2 ? "bg-[var(--sq-dark)]" : "bg-[var(--sq-light)]"} />
          ))}
        </div>
        <span className="absolute top-[50%] left-[75%] size-[22px] rounded-sm bg-accent/60 ring-2 ring-accent transition-opacity duration-300" style={{ opacity: hopped ? 0 : 1 }} />
        <span
          className="absolute top-0 left-0 grid size-[22px] place-items-center text-[22px] leading-none text-black transition-transform duration-500 ease-out"
          style={{ transform: hopped ? "translate(66px, 44px)" : "translate(0, 0)" }}
        >
          ♞
        </span>
      </div>
    );
  }

  if (id === "rush") {
    const left = Math.max(0, 161 - t);
    const m = Math.floor(left / 60);
    const s = String(left % 60).padStart(2, "0");
    return (
      <div className="text-center" aria-hidden>
        <p className="display text-4xl tabular text-accent">
          {m}:{s}
        </p>
        <p className="mt-1 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cx("size-2.5 rounded-full border transition-colors duration-300", t % 8 > i * 2 + 1 ? "border-bad bg-bad" : "border-ink-3")} />
          ))}
        </p>
      </div>
    );
  }

  if (id === "endgames") {
    const slid = t % 2 === 1;
    return (
      <div className="flex items-center gap-1 text-[34px] leading-none" aria-hidden>
        <span className="text-ink">♔</span>
        <span className="text-accent transition-transform duration-500 ease-out" style={{ transform: slid ? "translateX(26px)" : "none" }}>
          ♖
        </span>
        <span className={cx("text-ink-2 transition-opacity duration-500", slid && "opacity-40")}>♚</span>
      </div>
    );
  }

  if (id === "coordinates") {
    const sq = SQUARES[t % SQUARES.length];
    return (
      <p key={sq} className="display animate-[tile-pop_0.35s_ease-out] text-5xl tabular text-accent" aria-hidden>
        {alive ? sq : "e4"}
      </p>
    );
  }

  if (id === "blindfold") {
    const mv = MOVES[t % MOVES.length];
    return (
      <div className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs" aria-hidden>
        <p className="text-ink-3">The board is hidden.</p>
        <p className="mt-1 text-ink">
          <span className="text-accent">›</span> {mv}
          <span className={cx("ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-accent", alive && "animate-pulse")} />
        </p>
      </div>
    );
  }

  return null;
}

/** One practice mode as a tile with a live preview that reacts to hover, focus and touch. */
export function ModeTile({ id, title, Icon, onChoose }: { id: string; title: string; Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; onChoose: () => void }) {
  const [engaged, setEngaged] = useState(false);
  const alive = useAlive(engaged);
  return (
    <button
      type="button"
      onClick={onChoose}
      onPointerEnter={() => setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-[var(--shadow)] focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.985]"
    >
      <span className="flex h-[clamp(3rem,9dvh,8rem)] items-center justify-center overflow-hidden border-b border-border bg-bg/60 transition-colors group-hover:bg-accent-soft sm:h-32">
        <Preview id={id} alive={alive} />
      </span>
      <span className="flex items-center gap-2 p-2.5 sm:gap-2.5 sm:p-3.5">
        <Icon className="size-5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>
        <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
      </span>
    </button>
  );
}
