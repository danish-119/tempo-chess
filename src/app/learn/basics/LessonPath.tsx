"use client";

import { BookOpen, Check, Eye, GraduationCap, Grid3x3, Handshake, PenLine, Play, Scale, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";
import { PieceImage, type PieceLetter } from "@/components/learn/PieceImage";
import { cx } from "@/components/ui/primitives";
import { BASICS } from "@/lib/learn/basics";

type Glyph = PieceLetter | LucideIcon;

/** The picture on each lesson's medallion: the piece it is about, or an icon for the ideas. */
const GLYPHS: Record<string, Glyph> = {
  board: Grid3x3,
  setup: "K",
  squares: Grid3x3,
  rook: "R",
  bishop: "B",
  queen: "Q",
  king: "K",
  knight: "N",
  "knight-fork": "N",
  pawn: "P",
  capture: "P",
  "free-piece": "Q",
  protect: ShieldCheck,
  values: Scale,
  castle: "R",
  enpassant: "P",
  promote: "Q",
  check: "K",
  legal: "B",
  block: "B",
  "capture-checker": "N",
  mate: "Q",
  stalemate: "K",
  draws: Handshake,
  "mate-rook": "R",
  "mate-queen": "Q",
  "mate-ladder": "R",
  scholar: "Q",
  center: "P",
  develop: "N",
  "castle-early": "K",
  opening: BookOpen,
  "before-move": Eye,
  endgame: "K",
  notation: PenLine,
  rules: Scale,
  ready: Trophy,
};

type TileState = "done" | "current" | "next";

const FACE: Record<TileState, string> = {
  current: "bg-accent shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_25%,transparent),0_0_44px_color-mix(in_srgb,var(--accent)_55%,transparent)]",
  done: "bg-[color-mix(in_srgb,var(--accent)_72%,var(--surface))]",
  next: "border border-border bg-surface-2",
};
const EDGE: Record<TileState, string> = {
  current: "bg-[color-mix(in_srgb,var(--accent)_55%,black)]",
  done: "bg-[color-mix(in_srgb,var(--accent)_45%,black)]",
  next: "bg-border",
};

/** A raised, round medallion for one lesson. */
function Medallion({ index, state, onOpen }: { index: number; state: TileState; onOpen: () => void }) {
  const lesson = BASICS[index];
  const glyph = GLYPHS[lesson.id] ?? Play;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Lesson ${index + 1}: ${lesson.title}${state === "done" ? ", done" : state === "current" ? ", up next" : ""}`}
      aria-current={state === "current" ? "step" : undefined}
      className="group relative z-10 size-[84px] shrink-0 rounded-full focus-visible:outline-none"
    >
      <span className={cx("absolute inset-x-0 top-[7px] bottom-0 rounded-full", EDGE[state])} aria-hidden />
      <span
        className={cx(
          "absolute inset-x-0 top-0 bottom-[7px] rounded-full transition-[translate] duration-150 group-hover:-translate-y-0.5 group-active:translate-y-[5px] group-focus-visible:ring-4 group-focus-visible:ring-[var(--focus)]",
          FACE[state],
        )}
        aria-hidden
      />
      <span
        className={cx(
          "absolute inset-x-0 top-0 bottom-[7px] grid place-items-center transition-[translate] duration-150 group-hover:-translate-y-0.5 group-active:translate-y-[5px]",
          state === "next" && "opacity-45",
        )}
        aria-hidden
      >
        {typeof glyph === "string" ? (
          <PieceImage piece={glyph} className="size-11 text-[40px] [filter:drop-shadow(0_2px_2px_rgba(0,0,0,0.4))]" />
        ) : (
          (() => {
            const Icon = glyph;
            return <Icon className={cx("size-8 [filter:drop-shadow(0_2px_2px_rgba(0,0,0,0.3))]", state === "next" ? "text-ink-2" : "text-white")} strokeWidth={2.25} />;
          })()
        )}
      </span>
      {state === "done" ? (
        <span className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-bg bg-good text-white" aria-hidden>
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      ) : null}
      {state === "current" ? <span className="absolute inset-[-10px] animate-ping rounded-full border-2 border-accent/40 [animation-duration:2.4s]" aria-hidden /> : null}
    </button>
  );
}

function Title({ index, state, className }: { index: number; state: TileState; className?: string }) {
  return (
    <span className={cx("text-sm leading-tight", state === "next" ? "text-ink-3" : "font-semibold text-ink", className)} aria-hidden>
      {state === "current" ? <span className="eyebrow mb-0.5 block !text-[10px] !text-accent">Up next</span> : null}
      {BASICS[index].title}
    </span>
  );
}

const isChapterStart = (i: number) => i === 0 || BASICS[i - 1].chapter !== BASICS[i].chapter;

function ChapterTag({ index, className }: { index: number; className?: string }) {
  return <span className={cx("w-fit whitespace-nowrap rounded-full border border-border bg-surface px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-ink-2 uppercase", className)}>{BASICS[index].chapter}</span>;
}

/** Phones: one winding column, each lesson's name beside its medallion. */
function Column({ stateOf, onOpen }: { stateOf: (i: number) => TileState; onOpen: (i: number) => void }) {
  const ROW = 104;
  const swing = (i: number) => Math.round(Math.sin(i * 0.75) * 58);
  return (
    <ol className="relative md:hidden">
      {BASICS.map((l, i) => {
        const x = swing(i);
        const labelRight = x <= 0;
        return (
          <li key={l.id} className="relative">
            {isChapterStart(i) ? <ChapterTag index={i} className="mx-auto my-3 block" /> : null}
            <div className="relative flex items-center justify-center" style={{ height: ROW, transform: `translateX(${x}px)` }}>
              {i < BASICS.length - 1 && !isChapterStart(i + 1) ? (
                // a dotted trail from this medallion to the next one
                <svg className="pointer-events-none absolute top-1/2 left-1/2 overflow-visible" width="1" height="1" aria-hidden>
                  <line x1="0" y1="0" x2={swing(i + 1) - x} y2={ROW} stroke="var(--border)" strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
                </svg>
              ) : null}
              <Medallion index={i} state={stateOf(i)} onOpen={() => onOpen(i)} />
              <Title index={i} state={stateOf(i)} className={cx("absolute top-1/2 w-[8.5rem] -translate-y-1/2", labelRight ? "left-[calc(50%+3.4rem)] text-left" : "right-[calc(50%+3.4rem)] text-right")} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Wider screens: the path snakes across the page, left to right, down, then right to left. */
function Snake({ cols, stateOf, onOpen, className }: { cols: number; stateOf: (i: number) => TileState; onOpen: (i: number) => void; className?: string }) {
  const at = (i: number) => {
    const row = Math.floor(i / cols);
    const inRow = i % cols;
    return { row, col: row % 2 === 0 ? inRow : cols - 1 - inRow };
  };
  return (
    <ol className={cx("grid", className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {BASICS.map((l, i) => {
        const here = at(i);
        const next = i < BASICS.length - 1 ? at(i + 1) : null;
        return (
          <li key={l.id} className="relative flex h-[168px] flex-col items-center pt-7" style={{ gridRow: here.row + 1, gridColumn: here.col + 1 }}>
            {isChapterStart(i) ? <ChapterTag index={i} className="absolute top-0" /> : null}
            {next && next.row === here.row ? (
              <span
                className="absolute top-[70px] w-full border-t-4 border-dotted border-border"
                style={next.col > here.col ? { left: "50%" } : { right: "50%" }}
                aria-hidden
              />
            ) : next ? (
              <span className="absolute top-[70px] left-1/2 h-full -translate-x-1/2 border-l-4 border-dotted border-border" aria-hidden />
            ) : null}
            <Medallion index={i} state={stateOf(i)} onOpen={() => onOpen(i)} />
            <Title index={i} state={stateOf(i)} className="mt-2 w-[9rem] text-center" />
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The course as a path of medallions: finished lessons are lit, the next one glows, the rest wait. Any lesson can be
 * opened; the path only shows the way.
 */
export function LessonPath({ done, current, onOpen }: { done: readonly string[]; current: number; onOpen: (index: number) => void }) {
  const finished = BASICS.filter((l) => done.includes(l.id)).length;
  const stateOf = (i: number): TileState => (done.includes(BASICS[i].id) ? "done" : i === current ? "current" : "next");
  return (
    <div>
      <div className="mx-auto mb-6 flex max-w-2xl items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)]">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent shadow-[inset_0_-5px_0_rgba(0,0,0,0.2)]" aria-hidden>
          <GraduationCap className="size-8 text-accent-ink" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="display text-2xl">Learn to play</p>
          <p className="text-sm text-ink-3">
            {finished} of {BASICS.length} lessons done
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(finished / BASICS.length) * 100}%` }} />
          </div>
        </div>
        <button type="button" onClick={() => onOpen(current)} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent font-semibold text-accent-ink transition-[filter] hover:brightness-110 h-11 shrink-0 px-6 text-sm">
          {finished === 0 ? "Start" : "Continue"}
        </button>
      </div>

      <Column stateOf={stateOf} onOpen={onOpen} />
      <Snake cols={4} stateOf={stateOf} onOpen={onOpen} className="hidden md:grid lg:hidden" />
      <Snake cols={6} stateOf={stateOf} onOpen={onOpen} className="hidden lg:grid" />
    </div>
  );
}
