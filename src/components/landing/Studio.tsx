"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { OPERA_PLIES } from "@/content/opera-review";
import { PLAY_LEVELS } from "@/lib/play";
import { clamp01, stepFromProgress, useReducedMotion, useSceneProgress } from "./scroll";
import { PlayVisual } from "./studio/PlayVisual";
import { PRACTICE_TILES, PracticeVisual } from "./studio/PracticeVisual";
import { ReviewVisual } from "./studio/ReviewVisual";

const CHAPTERS = [
  {
    id: "play",
    n: "01",
    name: "Play",
    title: "Four ways to play",
    body: "Pick a bot, bring in the coach, challenge a friend with one link, or just watch two engines go at it.",
    bullets: ["Ten bots, from a gentle 400 to full Stockfish", "A coach that talks you through every move", "A friend anywhere, with a single link", "Or watch two engines play each other"],
    cta: { href: "/play", label: "Play now" },
  },
  {
    id: "review",
    n: "02",
    name: "Review",
    title: "Every move graded. With a reason.",
    body: "Stockfish checks every position in your browser and Tempo explains what happened in plain words.",
    bullets: ["Import from Chess.com, Lichess or a PGN", "Brilliant to Blunder, each with a reason", "Accuracy, key moments and an animated GIF"],
    cta: { href: "/review", label: "Review a game" },
  },
  {
    id: "practice",
    n: "03",
    name: "Practice",
    title: "Train what you actually get wrong.",
    body: "Puzzles at your level, endgames against perfect defence, blindfold chess, and a bank that brings your own mistakes back.",
    bullets: ["10,000 puzzles, endgames and blindfold chess", "A mistake bank that brings errors back", "Streaks and a daily puzzle, kept on your device"],
    cta: { href: "/practice", label: "Start training" },
  },
] as const;

/** A few of the ten real opponents, as small avatars. */
const BOTS = [0, 2, 4, 6, 9].map((i) => PLAY_LEVELS[i]);

function ChapterText({ chapter, headingId, children }: { chapter: (typeof CHAPTERS)[number]; headingId: string; children?: ReactNode }) {
  return (
    <div>
      <h2 id={headingId} className="display text-[clamp(1.9rem,min(4.6vw,8.5svh),4.25rem)]">
        {chapter.title}
      </h2>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-2 lg:mt-5 lg:text-base [@media(max-height:760px)]:mt-2">{chapter.body}</p>
      <ul className="mt-6 hidden space-y-2 lg:block [@media(max-height:760px)]:hidden">
        {chapter.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-[15px] text-ink-2">
            <span className="mt-2 size-1.5 shrink-0 rotate-45 bg-accent" aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      {chapter.id === "play" ? (
        <ul className="mt-5 hidden items-center lg:flex [@media(max-height:760px)]:!hidden" aria-label="Some of the ten opponents">
          {BOTS.map((b) => (
            <li key={b.level} className="-ml-2 first:ml-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.avatar} alt={b.name} title={`${b.name} · ${b.rating}`} className="size-10 rounded-full border-2 border-bg" draggable={false} />
            </li>
          ))}
          <li className="ml-3 font-mono text-xs text-ink-3">≈400 to Max</li>
        </ul>
      ) : null}
      <div className="mt-5 flex items-center gap-4 lg:mt-7 [@media(max-height:760px)]:mt-4">
        <Link href={chapter.cta.href} className="pill pill-solid !h-11 lg:!h-12">
          {chapter.cta.label}
        </Link>
        {children}
      </div>
    </div>
  );
}

/**
 * Play, Review and Practice as one continuous scene. A single stage stays pinned while you scroll: the board replays
 * the Opera Game, then the evaluation graph draws itself, then the practice modes appear. With reduced motion
 * nothing is pinned or scrubbed and all three chapters are simply shown in turn.
 */
export function Studio() {
  const reduced = useReducedMotion();
  const [ref, progress] = useSceneProgress<HTMLElement>();

  if (reduced) {
    return (
      <section className="land-dark" aria-label="What you can do with Tempo">
        <div className="land-wrap space-y-24 py-20 sm:py-24">
          {CHAPTERS.map((c, i) => (
            <div key={c.id} className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
              <div>
                <p className="eyebrow mb-5 !text-ink">
                  {c.n} · {c.name}
                </p>
                <ChapterText chapter={c} headingId={`${c.id}-h`} />
              </div>
              {i === 0 ? <PlayVisual ply={25} /> : i === 1 ? <ReviewVisual ply={OPERA_PLIES} accuracyT={1} /> : <PracticeVisual shown={PRACTICE_TILES} />}
            </div>
          ))}
        </div>
      </section>
    );
  }

  const chapter = stepFromProgress(progress, CHAPTERS.length);
  const local = clamp01(progress * CHAPTERS.length - chapter); // progress within the current chapter
  const playPly = chapter === 0 ? Math.round(clamp01(local / 0.92) * OPERA_PLIES) : OPERA_PLIES;
  const reviewPly = chapter < 1 ? 0 : chapter === 1 ? Math.round(clamp01(local / 0.86) * OPERA_PLIES) : OPERA_PLIES;
  const accuracyT = chapter < 1 ? 0 : chapter === 1 ? clamp01((local - 0.8) / 0.18) : 1;
  const tilesShown = chapter < 2 ? 0 : Math.min(PRACTICE_TILES, 1 + Math.floor(local * 9));

  const fade = (active: boolean) => cx("col-start-1 row-start-1 transition-[opacity,transform] duration-500", active ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0");

  return (
    <section ref={ref} className="land-dark relative h-[400vh] lg:h-[440vh]" aria-label="What you can do with Tempo" data-scene="studio" data-chapter={chapter}>
      <div className="sticky top-14 flex h-[calc(100svh-3.5rem)] items-start overflow-hidden pt-4 sm:pt-6 lg:items-center lg:pt-0">
        <div className="land-wrap grid w-full items-center gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <div className="min-w-0">
            <ol className="mb-4 flex gap-5 lg:mb-8 lg:gap-8" aria-label="Chapters">
              {CHAPTERS.map((c, i) => {
                const done = i < chapter;
                const active = i === chapter;
                return (
                  <li key={c.id} className="relative pb-2" aria-current={active ? "step" : undefined}>
                    <span className={cx("eyebrow transition-colors", (active || done) && "!text-ink")}>
                      {c.n} · {c.name}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-border" aria-hidden />
                    <span className="absolute bottom-0 left-0 h-0.5 bg-accent" style={{ width: `${done ? 100 : active ? local * 100 : 0}%` }} aria-hidden />
                  </li>
                );
              })}
            </ol>
            <div className="grid">
              {CHAPTERS.map((c, i) => (
                <div key={c.id} className={fade(i === chapter)} inert={i !== chapter} aria-hidden={i !== chapter}>
                  <ChapterText chapter={c} headingId={`${c.id}-h`} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid min-w-0">
            <div className={fade(chapter === 0)} inert={chapter !== 0} aria-hidden={chapter !== 0}>
              <PlayVisual ply={playPly} />
            </div>
            <div className={fade(chapter === 1)} inert={chapter !== 1} aria-hidden={chapter !== 1}>
              <ReviewVisual ply={reviewPly} accuracyT={accuracyT} />
            </div>
            <div className={fade(chapter === 2)} inert={chapter !== 2} aria-hidden={chapter !== 2}>
              <PracticeVisual shown={tilesShown} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
