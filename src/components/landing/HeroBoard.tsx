"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { EvalBar } from "@/components/analysis/EvalBar";
import { MoveClassBadge } from "@/components/analysis/MoveClassBadge";
import { Board } from "@/components/board/Board";
import { OPERA, OPERA_PLIES, operaFen, operaLabel, operaScore } from "@/content/opera-review";
import { useReducedMotion } from "./scroll";

/** The first frame is already a brilliant move (Morphy's Nxb5), so the page is interesting before anything moves. */
const START_AT = 19;
const STATIC_AT = 31; // for visitors who asked for less motion: the queen sacrifice
const STEP_MS = 1700;
const END_HOLD_MS = 4200;

/**
 * A real game, really reviewed: the Opera Game replays on the real board, with the evaluation and every grade and
 * sentence coming from Tempo's own review of it. It pauses on request and does not move at all for visitors who
 * prefer reduced motion.
 */
export function HeroBoard() {
  const reduced = useReducedMotion();
  const [ply, setPly] = useState(START_AT);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (reduced || !playing) return;
    const id = setTimeout(() => setPly((p) => (p >= OPERA_PLIES ? 0 : p + 1)), ply >= OPERA_PLIES ? END_HOLD_MS : STEP_MS);
    return () => clearTimeout(id);
  }, [ply, playing, reduced]);

  const shown = reduced ? STATIC_AT : ply;
  const move = shown > 0 ? OPERA.moves[shown - 1] : null;

  return (
    <figure className="relative mx-auto w-full max-w-[560px] lg:max-w-[min(560px,calc(100svh-16rem))]">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-accent/10 blur-3xl" aria-hidden />
      {/* The board is decorative and moves by itself, so it is hidden from screen readers; the caption below says what it shows. */}
      <div aria-hidden className="flex gap-3 rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow)] sm:p-4">
        <EvalBar score={operaScore(shown)} orientation="white" terminal={shown === OPERA_PLIES ? "w" : null} />
        <div className="min-w-0 flex-1">
          <Board
            fen={operaFen(shown)}
            orientation="white"
            lastMove={move ? { from: move.uci.slice(0, 2), to: move.uci.slice(2, 4) } : null}
            badge={move ? { square: move.uci.slice(2, 4), classification: move.cls } : null}
            interactive={false}
            id="landing-hero-board"
            ariaLabel="Opera Game replay"
          />
        </div>
      </div>

      <figcaption className="mt-5">
        <div aria-hidden className="min-h-[5.75rem]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-base font-semibold tabular text-ink">{operaLabel(shown)}</span>
            {move ? <MoveClassBadge classification={move.cls} /> : null}
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{move ? move.text : "Paul Morphy, White, to play."}</p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3">
          <p className="eyebrow !text-[11px] !tracking-[0.12em]">
            {OPERA.game.title} · {OPERA.game.where} · reviewed by {OPERA.engine}
          </p>
          {reduced ? null : (
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? "Pause the replay" : "Play the replay"}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-ink-2 transition-colors hover:border-ink hover:text-ink"
            >
              {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            </button>
          )}
        </div>
        <p className="sr-only">
          A replay of the Opera Game, {OPERA.game.white} against {OPERA.game.black}, {OPERA.game.where}, reviewed by {OPERA.engine}. Morphy
          wins in 17 moves with a queen sacrifice and a back-rank mate.
        </p>
      </figcaption>
    </figure>
  );
}
