"use client";

import { setQuery } from "@/lib/url";
import { docsReady, readDoc, writeDoc } from "@/lib/account/docs";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  Lightbulb,
  RotateCcw,
  Target,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Board, type BoardArrow } from "@/components/board/Board";
import { MiniBoard } from "@/components/learn/MiniBoard";
import { PieceImage, type PieceLetter } from "@/components/learn/PieceImage";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Button, ButtonLink, IconButton, cx } from "@/components/ui/primitives";
import { record } from "@/hooks/useProgress";
import { useSound } from "@/hooks/useSound";
import {
  BASICS,
  afterMove,
  completes,
  finishSpeech,
  introSpeech,
  lessonFen,
  startSquaresOf,
  tapCompletes,
  targetsOf,
  teachingMoves,
  trapFor,
} from "@/lib/learn/basics";
import { dateKey, recordActivity } from "@/lib/progress";
import { speak, speechSupported, stopSpeaking } from "@/lib/speech";
import { LessonPath } from "./LessonPath";

const PRAISE = [
  "Nice move, that is right.",
  "Well done, that is right.",
  "Good move, you got it.",
  "Exactly right.",
];

const NUMBER = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
];

/** What the coach says, and the page shows, when a piece is tapped in the pieces lesson. */
function legendLine(name: string, count: number): string {
  const piece = name.toLowerCase();
  return count === 1
    ? `This is the ${piece}. Each side has one ${piece}, and it starts on the lit square.`
    : `This is the ${piece}. Each side has ${NUMBER[count]} ${piece}s, and they start on the lit squares.`;
}

/** The pieces, by name and how many of each a side has. */
const LEGEND: readonly [PieceLetter, string, number][] = [
  ["K", "King", 1],
  ["Q", "Queen", 1],
  ["R", "Rook", 2],
  ["B", "Bishop", 2],
  ["N", "Knight", 2],
  ["P", "Pawn", 8],
];

const FILES = "abcdefgh";

/**
 * The square-naming practice: an empty board with its files and ranks written along the edges. Tap the named
 * square; a wrong tap is lit and named, so every tap teaches a square.
 */
function SquareQuiz({
  target,
  tapped,
  solved,
  onTap,
}: {
  target: string;
  tapped: string | null;
  solved: boolean;
  onTap: (square: string) => void;
}) {
  return (
    <div className="mx-auto w-full">
      <div
        className="grid aspect-square grid-cols-[1.25rem_repeat(8,minmax(0,1fr))] grid-rows-[repeat(8,minmax(0,1fr))_1.25rem] overflow-hidden rounded-md shadow-[var(--shadow)]"
        role="group"
        aria-label="Board: tap a square"
      >
        {Array.from({ length: 8 }, (_, r) => (
          <div key={r} className="contents">
            <span
              className="grid place-items-center bg-bg font-mono text-[11px] font-semibold text-ink-2"
              aria-hidden
            >
              {8 - r}
            </span>
            {Array.from({ length: 8 }, (_, c) => {
              const name = `${FILES[c]}${8 - r}`;
              const right = solved && name === target;
              const wrong = !solved && name === tapped && name !== target;
              return (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  onClick={() => onTap(name)}
                  className={cx(
                    "relative transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
                    "hover:brightness-110",
                  )}
                  style={{
                    background: right
                      ? "var(--good)"
                      : wrong
                        ? "var(--bad)"
                        : (r + c) % 2
                          ? "var(--sq-dark)"
                          : "var(--sq-light)",
                  }}
                >
                  {right || wrong ? (
                    <span className="absolute inset-0 grid place-items-center font-mono text-sm font-bold text-white">
                      {name}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
        <span className="bg-bg" aria-hidden />
        {Array.from({ length: 8 }, (_, c) => (
          <span
            key={c}
            className="grid place-items-center bg-bg font-mono text-[11px] font-semibold text-ink-2"
            aria-hidden
          >
            {FILES[c]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The finished lessons, kept in the account or the guest session. */
function loadDone(): string[] {
  const raw = readDoc<{ done?: unknown } | null>("basics", null);
  return Array.isArray(raw?.done) ? raw.done.filter((x): x is string => typeof x === "string") : [];
}

function saveDone(done: string[]) {
  writeDoc("basics", { done });
}

type Status = "idle" | "done" | "wrong" | "trap";

/**
 * The beginner course: one idea at a time, two or three things to do about it on a board, and a coach who talks you
 * through it, drawing arrows to everywhere the piece can go. The lessons are in src/lib/learn/basics.ts.
 */
export function BasicsView() {
  const { settings, update } = useSettings();
  const sound = useSound();
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [drillIndex, setDrillIndex] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [played, setPlayed] = useState<{
    fen: string;
    from: string;
    to: string;
  } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  /** After a lesson is finished the board shows the tip itself: the position, with the key squares lit. */
  const [tipView, setTipView] = useState(false);
  /** The pieces lesson: which kind of piece is lit up on the board. */
  const [legendPick, setLegendPick] = useState<PieceLetter | null>(null);
  /** The square-naming practice: the last square tapped. */
  const [tapped, setTapped] = useState<string | null>(null);
  const token = useRef(0);
  /** The path of all lessons, or one lesson open. */
  const [view, setView] = useState<"path" | "lesson">("path");
  /** Speech support is only known in the browser, so it is checked after the page has loaded (never while rendering on the server). */
  const [canSpeak, setCanSpeak] = useState(false);

  const lesson = BASICS[index];
  const drills = lesson.drills ?? [];
  const drill = drills[drillIndex] ?? null;
  const lastDrill = drillIndex >= drills.length - 1;
  const total = BASICS.length;
  const voiceOn = settings.coachVoice && canSpeak;
  const current = Math.max(
    0,
    BASICS.findIndex((l) => !done.includes(l.id)),
  );
  const lessonDone = drills.length === 0 || done.includes(lesson.id);
  const finished =
    drills.length === 0 ||
    (status === "done" && lastDrill) ||
    (done.includes(lesson.id) && status === "done");

  // Pick up where the learner left off.
  useEffect(() => {
    let alive = true;
    void docsReady().then(() => {
      if (!alive) return;
      setDone(loadDone());
      setCanSpeak(speechSupported());
      const wanted = new URLSearchParams(window.location.search).get("lesson");
      const at = BASICS.findIndex((l) => l.id === wanted);
      if (at >= 0) {
        setIndex(at);
        setView("lesson");
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The coach opens each step, and while talking shows everywhere the piece can go.
  useEffect(() => {
    if (!ready || view !== "lesson") return;
    const text =
      drillIndex === 0
        ? [introSpeech(lesson), drill?.task].filter(Boolean).join(" ")
        : (drill?.task ?? "");
    const mine = ++token.current;
    const begin = window.setTimeout(
      () => token.current === mine && setSpeaking(true),
      0,
    );
    const stop = window.setTimeout(
      () => token.current === mine && setSpeaking(false),
      Math.min(16000, 3000 + text.length * 60),
    );
    if (voiceOn)
      speak(text, {
        onEnd: () => token.current === mine && setSpeaking(false),
      });
    else stopSpeaking();
    return () => {
      window.clearTimeout(begin);
      window.clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, index, drillIndex, voiceOn]);
  useEffect(() => stopSpeaking, []);

  // Once the last practice is done, give the player a moment with their own move, then show the tip on the board.
  const tipExample = lesson.tip?.example;
  useEffect(() => {
    if (!(status === "done" && lastDrill && tipExample)) return;
    const id = window.setTimeout(() => setTipView(true), 1300);
    return () => window.clearTimeout(id);
  }, [status, lastDrill, tipExample]);

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
    setPlayed(null);
    setTipView(false);
    setLegendPick(null);
    setTapped(null);
  }, []);

  const markRead = () => {
    if (drills.length > 0 || done.includes(lesson.id)) return;
    const next = [...done, lesson.id];
    setDone(next);
    saveDone(next);
  };

  const openLesson = (to: number) => {
    setView("lesson");
    goLesson(to);
  };

  const backToPath = () => {
    markRead();
    stopSpeaking();
    setView("path");
    setQuery({ lesson: null });
  };

  const goLesson = useCallback(
    (to: number) => {
      const at = Math.max(0, Math.min(BASICS.length - 1, to));
      setIndex(at);
      setQuery({ lesson: BASICS[at].id });
      setDrillIndex(0);
      setShowMoves(false);
      reset();
    },
    [reset],
  );

  const nextDrill = () => {
    setDrillIndex((i) => i + 1);
    reset();
  };

  const say = (text: string) => {
    if (voiceOn) speak(text);
  };

  const onMove = (uci: string): boolean => {
    if (!drill || status === "done" || status === "trap") return false;
    const trap = trapFor(drill, uci);
    const r = afterMove(drill.fen, uci);
    if (trap && r) {
      setPlayed(r);
      setStatus("trap");
      setMessage(trap);
      sound.playSan(r.san);
      say(trap);
      return true;
    }
    if (!completes(drill, uci)) {
      setStatus("wrong");
      setMessage("Not quite. Try again.");
      say("Not quite. Try again.");
      return false;
    }
    if (!r) return false;
    setPlayed(r);
    setStatus("done");
    sound.playSan(r.san);
    if (lastDrill) {
      const next = done.includes(lesson.id) ? done : [...done, lesson.id];
      setDone(next);
      saveDone(next);
      record((p) => recordActivity(p, dateKey()));
      say(finishSpeech(lesson));
    } else {
      say(PRAISE[drillIndex % PRAISE.length]);
    }
    return true;
  };

  const showingTip = tipView && !!tipExample;
  const quiz = drill?.goal.kind === "square" ? drill : null;

  /** The square-naming practice: right square, or a gentle "that is b6" and try again. */
  const onTap = (square: string) => {
    if (!quiz || status === "done") return;
    setTapped(square);
    if (!tapCompletes(quiz, square)) {
      setStatus("wrong");
      setMessage(`That is ${square}. Try again.`);
      say(`That is ${square}. Try again.`);
      return;
    }
    setStatus("done");
    if (lastDrill) {
      const next = done.includes(lesson.id) ? done : [...done, lesson.id];
      setDone(next);
      saveDone(next);
      record((p) => recordActivity(p, dateKey()));
      say(finishSpeech(lesson));
    } else {
      say(PRAISE[drillIndex % PRAISE.length]);
    }
  };

  const stars: Record<string, "hint"> | undefined = legendPick
    ? Object.fromEntries(
        startSquaresOf(legendPick).map((sq) => [sq, "hint" as const]),
      )
    : showingTip && tipExample
      ? Object.fromEntries(
          (tipExample.glow ?? []).map((sq) => [sq, "hint" as const]),
        )
      : drill && (status === "idle" || status === "wrong")
        ? Object.fromEntries(
            targetsOf(drill).map((sq) => [sq, "hint" as const]),
          )
        : undefined;
  const arrows: BoardArrow[] =
    drill &&
    (status === "idle" || status === "wrong") &&
    (speaking || showMoves)
      ? teachingMoves(drill).map((m) => ({
          from: m.from,
          to: m.to,
          kind: "best" as const,
        }))
      : [];
  const fen =
    showingTip && tipExample
      ? tipExample.fen
      : (played?.fen ?? drill?.fen ?? lessonFen(lesson));
  const turn =
    (drill?.fen ?? lessonFen(lesson)).split(" ")[1] === "b" ? "b" : "w";
  const live =
    !showingTip && drill !== null && status !== "done" && status !== "trap";

  if (view === "path")
    return <LessonPath done={done} current={current} onOpen={openLesson} />;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={backToPath}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> All lessons
      </button>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
        <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-23rem))] lg:max-w-[min(100%,calc(100dvh-11rem))]">
          {quiz ? (
            <SquareQuiz
              target={quiz.goal.kind === "square" ? quiz.goal.square : ""}
              tapped={tapped}
              solved={status === "done"}
              onTap={onTap}
            />
          ) : (
            <Board
              key={`${lesson.id}-${drillIndex}-${showingTip ? "tip" : "play"}`}
              fen={fen}
              orientation={turn === "b" ? "black" : "white"}
              lastMove={
                played && !showingTip
                  ? { from: played.from, to: played.to }
                  : null
              }
              highlights={stars}
              arrows={arrows}
              arrowsAlways
              interactive={live}
              movableColor={turn}
              onMove={onMove}
              id="tempo-basics"
              ariaLabel={`${lesson.title}: ${showingTip ? "tip" : "practice"} board`}
            />
          )}
          {showingTip && tipExample ? (
            <p className="mt-2 flex items-center justify-center gap-2 text-center text-sm font-medium text-accent animate-[tile-pop_0.3s_ease-out]">
              <Lightbulb className="size-4 shrink-0" aria-hidden />{" "}
              {tipExample.caption}
            </p>
          ) : null}
        </div>

        <section
          className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)] sm:p-5"
          aria-label="Lesson"
        >
          {/* progress: one segment per lesson */}
          <div className="flex gap-0.5" role="group" aria-label="Steps">
            {BASICS.map((l, i) => (
              <button
                key={l.id}
                type="button"
                onClick={() => goLesson(i)}
                aria-label={`Step ${i + 1}: ${l.title}`}
                aria-current={i === index ? "step" : undefined}
                className="group min-w-0 flex-1 py-2"
              >
                <span
                  className={cx(
                    "block h-1.5 rounded-full transition-colors",
                    i === index
                      ? "bg-ink"
                      : done.includes(l.id) || (!l.drills && i < index)
                        ? "bg-accent"
                        : "bg-surface-2 group-hover:bg-border",
                  )}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow flex items-center gap-1.5 !text-[11px]">
              <GraduationCap className="size-3.5 text-accent" aria-hidden />
              {lesson.chapter} · {index + 1}/{total}
            </p>
            {canSpeak ? (
              <IconButton
                label={
                  voiceOn
                    ? "Coach voice on. Turn off"
                    : "Coach voice off. Turn on"
                }
                onClick={() => {
                  if (voiceOn) {
                    update({ coachVoice: false });
                    stopSpeaking();
                  } else {
                    update({ coachVoice: true });
                  }
                }}
                className="!size-8"
              >
                {voiceOn ? (
                  <Volume2 className="size-4" aria-hidden />
                ) : (
                  <VolumeX className="size-4" aria-hidden />
                )}
              </IconButton>
            ) : null}
          </div>

          <div key={lesson.id} className="animate-[tile-pop_0.25s_ease-out]">
            <h2 className="display text-3xl">{lesson.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {lesson.text}
            </p>
            {lesson.legend ? (
              <ul
                className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6"
                aria-label="The pieces"
              >
                {LEGEND.map(([piece, name, count]) => (
                  <li key={piece}>
                    <button
                      type="button"
                      aria-pressed={legendPick === piece}
                      onClick={() => {
                        const next = legendPick === piece ? null : piece;
                        setLegendPick(next);
                        if (next) say(legendLine(name, count));
                      }}
                      className={cx(
                        "flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center transition-colors",
                        legendPick === piece
                          ? "border-accent bg-accent-soft"
                          : "border-border bg-bg hover:border-ink-3",
                      )}
                    >
                      <PieceImage
                        piece={piece}
                        className="size-9 text-[32px]"
                      />
                      <span className="text-xs font-semibold">{name}</span>
                      <span className="font-mono text-[10px] text-ink-3">
                        × {count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {lesson.legend && legendPick ? (
              <p className="mt-2 text-sm text-ink-2" aria-live="polite">
                {(() => {
                  const row = LEGEND.find(([p]) => p === legendPick)!;
                  return legendLine(row[1], row[2]);
                })()}
              </p>
            ) : null}
            {lesson.examples ? (
              <ul
                className="mt-4 grid grid-cols-3 gap-2.5"
                aria-label="Examples"
              >
                {lesson.examples.map((e) => (
                  <li key={e.caption} className="min-w-0">
                    <div className="mx-auto aspect-square w-full max-w-[110px]">
                      <MiniBoard
                        fen={e.fen}
                        glow={e.glow}
                        coords={lesson.coords}
                        className="!max-h-none"
                      />
                    </div>
                    <p className="mt-1.5 text-center text-[11px] leading-tight text-ink-2">
                      {e.caption}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {drill ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="eyebrow flex items-center gap-2 !text-[11px]"
                  aria-label={`Practice ${drillIndex + 1} of ${drills.length}`}
                >
                  Practice
                  <span className="flex gap-1" aria-hidden>
                    {drills.map((_, i) => (
                      <span
                        key={i}
                        className={cx(
                          "size-2 rounded-full",
                          i < drillIndex ||
                            (i === drillIndex && status === "done")
                            ? "bg-accent"
                            : i === drillIndex
                              ? "bg-ink"
                              : "bg-surface-2",
                        )}
                      />
                    ))}
                  </span>
                </p>
                {teachingMoves(drill).length > 0 ? (
                  <button
                    type="button"
                    aria-pressed={showMoves}
                    onClick={() => setShowMoves((v) => !v)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-ink"
                  >
                    {showMoves ? (
                      <EyeOff className="size-3.5" aria-hidden />
                    ) : (
                      <Eye className="size-3.5" aria-hidden />
                    )}{" "}
                    Show moves
                  </button>
                ) : null}
              </div>
              <p
                className={cx(
                  "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium",
                  status === "done"
                    ? "border-good/50 bg-good/10 text-ink"
                    : status === "wrong" || status === "trap"
                      ? "border-bad/50 bg-bad/10 text-ink"
                      : "border-accent/40 bg-accent-soft text-ink",
                )}
                role="status"
                aria-live="polite"
              >
                {status === "done" ? (
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-good"
                    aria-hidden
                  />
                ) : (
                  <Target
                    className="mt-0.5 size-4 shrink-0 text-accent"
                    aria-hidden
                  />
                )}
                <span>
                  {status === "done"
                    ? lastDrill
                      ? (lesson.done ?? "Well done.")
                      : PRAISE[drillIndex % PRAISE.length]
                    : status === "wrong" || status === "trap"
                      ? message
                      : drill.task}
                </span>
              </p>
              {status === "trap" ? (
                <Button size="sm" onClick={reset}>
                  <RotateCcw className="size-4" aria-hidden /> Try again
                </Button>
              ) : null}
            </div>
          ) : null}

          {finished && lesson.tip ? (
            <div className="rounded-xl border border-border bg-bg p-3 animate-[tile-pop_0.3s_ease-out]">
              <p className="eyebrow flex items-center gap-1.5 !text-[11px]">
                <Lightbulb className="size-3.5 text-accent" aria-hidden /> A tip
              </p>
              <div className="mt-2 flex items-start gap-3">
                {lesson.tip.example ? (
                  <div className="w-[96px] shrink-0">
                    <MiniBoard
                      fen={lesson.tip.example.fen}
                      glow={lesson.tip.example.glow}
                      className="!max-h-none"
                    />
                    <p className="mt-1 text-center text-[10px] leading-tight text-ink-3">
                      {lesson.tip.example.caption}
                    </p>
                  </div>
                ) : null}
                <p className="text-sm leading-relaxed text-ink-2">
                  {lesson.tip.text}
                </p>
              </div>
              {tipExample ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => setTipView((v) => !v)}
                >
                  {showingTip ? "Back to my move" : "Show it on the board"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {lesson.final ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <ButtonLink href="/play" variant="primary">
                Play a game
              </ButtonLink>
              <ButtonLink href="/practice">Practice puzzles</ButtonLink>
              <ButtonLink href="/learn/openings">Study openings</ButtonLink>
              <ButtonLink href="/learn/tactics">Learn tactics</ButtonLink>
            </div>
          ) : null}

          <div className="mt-auto flex items-center gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() =>
                drillIndex > 0
                  ? (setDrillIndex(drillIndex - 1), reset())
                  : goLesson(index - 1)
              }
              disabled={index === 0 && drillIndex === 0}
              aria-label="Previous step"
            >
              <ChevronLeft className="size-4" aria-hidden /> Back
            </Button>
            {voiceOn ? (
              <Button
                variant="ghost"
                onClick={() => {
                  const mine = ++token.current;
                  setSpeaking(true);
                  speak(
                    finished && lastDrill
                      ? finishSpeech(lesson)
                      : [
                          drillIndex === 0 ? introSpeech(lesson) : "",
                          drill?.task,
                        ]
                          .filter(Boolean)
                          .join(" "),
                    {
                      onEnd: () => token.current === mine && setSpeaking(false),
                    },
                  );
                }}
                aria-label="Hear this step again"
              >
                <Volume2 className="size-4" aria-hidden /> Listen
              </Button>
            ) : null}
            {drill && !lastDrill ? (
              <Button
                variant={status === "done" ? "primary" : "ghost"}
                className="ml-auto"
                onClick={nextDrill}
              >
                {status === "done" ? "Next practice" : "Skip"}{" "}
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : index < total - 1 ? (
              <Button
                variant={
                  lessonDone && (drills.length === 0 || status === "done")
                    ? "primary"
                    : "ghost"
                }
                className="ml-auto"
                onClick={() => {
                  markRead();
                  goLesson(index + 1);
                }}
              >
                {drills.length === 0 || status === "done" ? "Next" : "Skip"}{" "}
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button
                variant="primary"
                className="ml-auto"
                onClick={backToPath}
              >
                Finish
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
