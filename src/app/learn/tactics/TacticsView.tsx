"use client";

import { MiniBoard } from "@/components/learn/MiniBoard";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { ArrowLeft, Check, ChevronRight, Eye, Lightbulb, Puzzle as PuzzleIcon, RotateCcw, Target } from "lucide-react";
import { Board, type BoardArrow } from "@/components/board/Board";
import { Alert, Button, ButtonLink, cx } from "@/components/ui/primitives";
import { BoardSkeleton } from "@/components/ui/Skeleton";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { useCoachVoice, VoiceToggle } from "@/hooks/useCoachVoice";
import { useSound } from "@/hooks/useSound";
import { TACTICS, TACTIC_GROUPS, TACTIC_PRACTICES, type TacticLesson, examplesFor, tacticByTheme } from "@/lib/learn/tactics";
import { type Puzzle, isCorrectMove, loadPuzzles, preparePuzzle } from "@/lib/puzzles";
import { setQuery } from "@/lib/url";

/** Themes with enough bundled puzzles to practise on their own. */
const PRACTICE_MIN = 15;

export function TacticsView() {
  const params = useSearchParams();
  const [tactic, setTactic] = useState<TacticLesson | null>(() => tacticByTheme(params.get("t")));
  const [group, setGroup] = useState<(typeof TACTIC_GROUPS)[number]>(() => tacticByTheme(params.get("t"))?.group ?? TACTIC_GROUPS[0]);

  const open = (t: TacticLesson | null) => {
    setTactic(t);
    setQuery({ t: t?.theme ?? null });
    window.scrollTo({ top: 0 });
  };

  if (!tactic) return <TacticsList group={group} setGroup={setGroup} onOpen={open} />;

  return <TacticLessonView key={tactic.theme} tactic={tactic} onBack={() => open(null)} />;
}

const PIECE_NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const PRAISE = ["Good move. Keep going.", "That is right. Keep going.", "Nice. Now finish it off."];

type Status = "your-move" | "wrong" | "reply" | "solved" | "shown";

/**
 * One tactic, taught the way the basics are: the coach explains the idea, then you find it yourself on real
 * positions, three times. Wrong moves are turned down kindly, a hint first points at the piece and then at the
 * move, and "Show me" plays the answer. Everything shown in the box is exactly what the coach says.
 */
/** A real position for each tactic: the start of its easiest example puzzle, from the solver's side. */
function usePreviews(): Record<string, { fen: string; flip: boolean }> {
  const [previews, setPreviews] = useState<Record<string, { fen: string; flip: boolean }>>({});
  useEffect(() => {
    let alive = true;
    loadPuzzles().then((all) => {
      if (!alive) return;
      const out: Record<string, { fen: string; flip: boolean }> = {};
      for (const t of TACTICS) {
        const first = examplesFor(all, t.theme, 1)[0];
        const p = first ? preparePuzzle(first) : null;
        if (p) out[t.theme] = { fen: p.startFen, flip: p.solver === "b" };
      }
      setPreviews(out);
    }, () => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return previews;
}

/** The kinds of tactic as tabs, and each tactic as a tile with a real position from its practice. */
function TacticsList({ group, setGroup, onOpen }: { group: (typeof TACTIC_GROUPS)[number]; setGroup: (g: (typeof TACTIC_GROUPS)[number]) => void; onOpen: (t: TacticLesson) => void }) {
  const previews = usePreviews();
  const shown = TACTICS.filter((t) => t.group === group);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Kinds of tactic" className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1">
        {TACTIC_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={group === g}
            onClick={() => setGroup(g)}
            className={cx(
              "flex-1 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
              group === g ? "bg-accent text-accent-ink shadow-sm" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {g}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-label={group}>
        {shown.map((t, i) => {
          const pv = previews[t.theme];
          return (
            <li key={`${group}-${t.theme}`} className="animate-[tile-pop_0.3s_ease-out_both]" style={{ animationDelay: `${i * 25}ms` }}>
              <button
                type="button"
                onClick={() => onOpen(t)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-[var(--shadow)] focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="block aspect-square w-full p-2.5 pb-0" aria-hidden>
                  {pv ? (
                    <MiniBoard fen={pv.fen} flip={pv.flip} className="!max-h-none !text-base sm:!text-lg" />
                  ) : (
                    <span className="block size-full animate-pulse rounded-md bg-surface-2" />
                  )}
                </span>
                <span className="flex items-center justify-between gap-2 p-3">
                  <span className="min-w-0 truncate font-semibold group-hover:text-accent">{t.name}</span>
                  <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TacticLessonView({ tactic, onBack }: { tactic: TacticLesson; onBack: () => void }) {
  const voice = useCoachVoice();
  const { say } = voice;
  const sound = useSound();
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState<number[]>([]);
  const [tipSaid, setTipSaid] = useState(false);
  const [fen, setFen] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [last, setLast] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState<Status>("your-move");
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    loadPuzzles().then(setPuzzles, () => setFailed(true));
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const examples = useMemo(() => (puzzles ? examplesFor(puzzles, tactic.theme) : []), [puzzles, tactic.theme]);
  const count = useMemo(() => (puzzles ? puzzles.filter((p) => p.themes.includes(tactic.theme)).length : 0), [puzzles, tactic.theme]);
  const prepared = useMemo(() => (examples.length ? preparePuzzle(examples[index % examples.length]) : null), [examples, index]);
  const side = prepared?.solver === "b" ? "Black" : "White";
  const task = `${side} to move. ${tactic.task}`;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // Set up each practice, and let the coach introduce it: the whole idea the first time, then just the task.
  const begin = useCallback(() => {
    if (!prepared) return;
    clearTimers();
    setFen(prepared.startFen);
    setStep(0);
    setLast({ from: prepared.setupMove.slice(0, 2), to: prepared.setupMove.slice(2, 4) });
    setStatus("your-move");
    setMessage(task);
    setHint(0);
  }, [prepared, task]);

  useEffect(() => {
    if (!prepared) return;
    const id = window.setTimeout(() => {
      begin();
      say(index === 0 ? `${tactic.name}. ${tactic.explain} ${task}` : task);
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  const tell = (status: Status, text: string) => {
    setStatus(status);
    setMessage(text);
    say(text);
  };

  const finish = () => {
    const first = !tipSaid;
    const text = solved.length === 0 && first ? `Well done, you found the ${tactic.name.toLowerCase()}.` : "Well done, you solved it.";
    setSolved((s) => (s.includes(index) ? s : [...s, index]));
    setStatus("solved");
    setMessage(text);
    say(first ? `${text} A tip. ${tactic.lookFor}` : text);
    setTipSaid(true);
  };

  const onMove = (uci: string): boolean => {
    if (!prepared || !fen || (status !== "your-move" && status !== "wrong")) return false;
    if (!isCorrectMove(fen, prepared.solution, step, uci)) {
      sound.play("incorrect");
      tell("wrong", hint ? "That is not it. Follow the hint and try again." : "Not quite. Try again.");
      return false;
    }
    const chess = new Chess(fen);
    const mine = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    sound.playSan(mine.san);
    setFen(chess.fen());
    setLast({ from: mine.from, to: mine.to });
    setHint(0);
    const next = step + 1;
    if (next >= prepared.solution.length) {
      setStep(next);
      finish();
      return true;
    }
    // The opponent answers, and the learner carries on.
    setStatus("reply");
    setMessage("");
    later(() => {
      const reply = prepared.solution[next];
      const r = chess.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
      sound.playSan(r.san);
      setFen(chess.fen());
      setLast({ from: r.from, to: r.to });
      setStep(next + 1);
      if (next + 1 >= prepared.solution.length) finish();
      else tell("your-move", PRAISE[(next >> 1) % PRAISE.length]);
    }, 600);
    return true;
  };

  const expected = prepared && fen && step < prepared.solution.length && (status === "your-move" || status === "wrong") ? prepared.solution[step] : null;

  const showHint = () => {
    if (!expected || !fen) return;
    const chess = new Chess(fen);
    if (hint === 0) {
      const piece = chess.get(expected.slice(0, 2) as never);
      setHint(1);
      tell(status, `Look at your ${PIECE_NAME[piece?.type ?? "p"]}.`);
    } else {
      const m = chess.move({ from: expected.slice(0, 2), to: expected.slice(2, 4), promotion: expected[4] });
      setHint(2);
      tell(status, `Try ${m.san}.`);
    }
  };

  const showMe = () => {
    if (!prepared || !fen) return;
    clearTimers();
    const chess = new Chess(fen);
    const rest = prepared.solution.slice(step);
    setStatus("shown");
    setMessage("Here is the answer. Watch the moves.");
    say("Here is the answer. Watch the moves.");
    setHint(0);
    rest.forEach((u, i) => {
      later(() => {
        const m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        sound.playSan(m.san);
        setFen(chess.fen());
        setLast({ from: m.from, to: m.to });
      }, 700 * (i + 1));
    });
  };

  const done = status === "solved" || status === "shown";
  const practice = index % TACTIC_PRACTICES;
  const hintSquares: Record<string, "hint"> | undefined = expected && hint >= 1 ? { [expected.slice(0, 2)]: "hint" } : undefined;
  const arrows: BoardArrow[] = expected && hint >= 2 ? [{ from: expected.slice(0, 2), to: expected.slice(2, 4), kind: "best" }] : [];

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-16rem))] lg:max-w-[min(100%,calc(100dvh-11rem))]">
        {failed ? (
          <Alert tone="error">The practice positions could not be loaded. Please reload the page.</Alert>
        ) : !puzzles ? (
          <BoardSkeleton label="Loading the practice positions…" />
        ) : prepared && fen ? (
          <Board
            key={prepared.puzzle.id}
            fen={fen}
            orientation={prepared.solver === "w" ? "white" : "black"}
            lastMove={last}
            highlights={hintSquares}
            arrows={arrows}
            arrowsAlways
            interactive={status === "your-move" || status === "wrong"}
            movableColor={prepared.solver}
            onMove={onMove}
            ariaLabel={`${tactic.name}: practice board`}
          />
        ) : (
          <Alert tone="info">There is no practice position for this pattern yet.</Alert>
        )}
      </div>

      <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)] sm:p-5" aria-label="Lesson">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-bg px-3 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden /> All tactics
          </button>
          <VoiceToggle voice={voice} />
        </div>

        <div>
          <p className="eyebrow !text-[11px]">{tactic.group}</p>
          <h2 className="display mt-1 text-3xl">{tactic.name}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{tactic.explain}</p>
        </div>

        {prepared ? (
          <div className="space-y-2">
            <p className="eyebrow flex items-center gap-2 !text-[11px]" aria-label={`Practice ${practice + 1} of ${TACTIC_PRACTICES}`}>
              Practice
              <span className="flex gap-1" aria-hidden>
                {Array.from({ length: TACTIC_PRACTICES }, (_, i) => (
                  <span
                    key={i}
                    className={cx(
                      "size-2 rounded-full",
                      solved.includes(index - practice + i) || (i === practice && status === "solved") ? "bg-accent" : i === practice ? "bg-ink" : "bg-surface-2",
                    )}
                  />
                ))}
              </span>
            </p>
            <p
              className={cx(
                "flex min-h-11 items-start gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium",
                status === "solved" ? "border-good/50 bg-good/10" : status === "wrong" ? "border-bad/50 bg-bad/10" : "border-accent/40 bg-accent-soft",
              )}
              role="status"
              aria-live="polite"
            >
              {status === "solved" ? <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden /> : <Target className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />}
              <span>{status === "reply" ? "Your opponent is answering…" : message}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {done ? (
                <>
                  <Button size="sm" variant="primary" onClick={() => setIndex((i) => i + 1)}>
                    Next practice <ChevronRight className="size-4" aria-hidden />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { begin(); say(task); }}>
                    <RotateCcw className="size-4" aria-hidden /> Try it again
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={showHint} disabled={!expected || hint >= 2}>
                    <Lightbulb className="size-4" aria-hidden /> Hint
                  </Button>
                  <Button size="sm" variant="ghost" onClick={showMe} disabled={!expected}>
                    <Eye className="size-4" aria-hidden /> Show me
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {tipSaid ? (
          <div className="rounded-xl border border-border bg-bg p-3 animate-[tile-pop_0.3s_ease-out]">
            <p className="eyebrow flex items-center gap-1.5 !text-[11px]">
              <Lightbulb className="size-3.5 text-accent" aria-hidden /> A tip
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{tactic.lookFor}</p>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {count >= PRACTICE_MIN ? (
            <ButtonLink size="sm" variant={solved.length >= TACTIC_PRACTICES ? "primary" : "secondary"} href={`/practice?mode=puzzles&level=any&theme=${encodeURIComponent(tactic.theme)}`}>
              <PuzzleIcon className="size-4" aria-hidden /> Practise {count} puzzles
            </ButtonLink>
          ) : null}
          <CopyLinkButton />
        </div>
      </section>
    </div>
  );
}
