"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Check, Flame, Play, RotateCcw, Timer, Trophy, X } from "lucide-react";
import { Board } from "@/components/board/Board";
import { Alert, Button, Card, Spinner, cx } from "@/components/ui/primitives";
import { useSound } from "@/hooks/useSound";
import { applyUci, parseUci, uciToSan } from "@/lib/chess/line";
import { type PreparedPuzzle, type Puzzle, isCorrectMove, loadPuzzles, preparePuzzle } from "@/lib/puzzles";
import { RUSH_MODES, RUSH_STRIKES, type RushModeId, loadBest, pickRushPuzzle, saveBest } from "@/lib/rush";
import { setQuery } from "@/lib/url";

interface Attempt {
  puzzle: PreparedPuzzle;
  solved: boolean;
}

type Phase = "ready" | "running" | "over";

function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function PuzzleRush({ initialMode }: { initialMode?: string | null }) {
  const sound = useSound();
  const [all, setAll] = useState<Puzzle[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setModeState] = useState<RushModeId>(() => RUSH_MODES.find((m) => m.id === initialMode)?.id ?? "3min");
  const setMode = (m: RushModeId) => {
    setModeState(m);
    setQuery({ rush: m });
  };
  const [phase, setPhase] = useState<Phase>("ready");
  const [current, setCurrent] = useState<PreparedPuzzle | null>(null);
  const [fen, setFen] = useState("");
  const [step, setStep] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [best, setBest] = useState(0);
  const [record, setRecord] = useState(false);
  const seen = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => {
    loadPuzzles().then(setAll, () => setLoadError(true));
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBest(loadBest(mode));
  }, [mode]);

  const score = attempts.filter((a) => a.solved).length;
  const strikes = attempts.filter((a) => !a.solved).length;
  const seconds = RUSH_MODES.find((m) => m.id === mode)?.seconds ?? null;
  const remaining = deadline === null ? null : Math.max(0, (deadline - now) / 1000);

  const finish = useCallback(
    (finalAttempts: Attempt[]) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setPhase("over");
      setDeadline(null);
      const finalScore = finalAttempts.filter((a) => a.solved).length;
      const isRecord = saveBest(mode, finalScore);
      setRecord(isRecord);
      if (isRecord) setBest(finalScore);
      sound.play(isRecord ? "victory" : "game-end");
    },
    [mode, sound],
  );

  const nextPuzzle = useCallback(
    (index: number) => {
      if (!all) return;
      const p = pickRushPuzzle(all, index, seen.current);
      const prepared = p ? preparePuzzle(p) : null;
      if (!prepared) return;
      seen.current.add(prepared.puzzle.id);
      setCurrent(prepared);
      setStep(0);
      // Rush keeps a fast pace: the opponent's setup move plays immediately.
      setFen(prepared.startFen);
      const m = parseUci(prepared.setupMove);
      setLastMove(m ? { from: m.from, to: m.to } : null);
    },
    [all],
  );

  const start = () => {
    seen.current = new Set();
    setAttempts([]);
    setRecord(false);
    setFlash(null);
    setPhase("running");
    const t0 = Date.now();
    setNow(t0);
    setDeadline(seconds === null ? null : t0 + seconds * 1000);
    nextPuzzle(0);
  };

  // Clock
  useEffect(() => {
    if (phase !== "running" || deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [phase, deadline]);

  useEffect(() => {
    if (phase === "running" && remaining !== null && remaining <= 0) {
      const t = setTimeout(() => finish(attempts), 0);
      return () => clearTimeout(t);
    }
  }, [phase, remaining, attempts, finish]);

  const record_ = (solved: boolean) => {
    if (!current) return;
    const nextAttempts = [...attempts, { puzzle: current, solved }];
    setAttempts(nextAttempts);
    setFlash(solved ? "good" : "bad");
    later(() => setFlash(null), 350);
    if (!solved && nextAttempts.filter((a) => !a.solved).length >= RUSH_STRIKES) {
      finish(nextAttempts);
      return;
    }
    later(() => nextPuzzle(nextAttempts.length), solved ? 250 : 450);
  };

  const onMove = (uci: string): boolean => {
    if (phase !== "running" || !current) return false;
    if (!isCorrectMove(fen, current.solution, step, uci)) {
      sound.play("incorrect");
      record_(false);
      return false;
    }
    const c = new Chess(fen);
    const m = applyUci(c, uci);
    if (!m) return false;
    sound.playSan(m.san);
    const after = c.fen();
    setFen(after);
    setLastMove({ from: m.from, to: m.to });
    const nextStep = step + 1;
    if (nextStep >= current.solution.length || c.isGameOver()) {
      sound.play("correct");
      record_(true);
      return true;
    }
    // Opponent reply
    setStep(nextStep + 1);
    later(() => {
      const reply = current.solution[nextStep];
      const r = new Chess(after);
      const rm = applyUci(r, reply);
      if (rm) {
        setFen(r.fen());
        setLastMove({ from: rm.from, to: rm.to });
        sound.playSan(rm.san);
      }
    }, 200);
    return true;
  };

  if (loadError) return <Alert tone="error">Puzzles could not be loaded. Please reload the page.</Alert>;
  if (!all) return <Spinner label="Loading puzzles…" />;

  if (phase === "ready") {
    return (
      <Card className="mx-auto max-w-lg space-y-5 p-6 text-center">
        <Flame className="mx-auto size-10 text-accent" aria-hidden />
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Rush mode">
          {RUSH_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cx(
                "flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-semibold transition-colors",
                mode === m.id ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
              )}
            >
              {m.seconds === null ? <X className="size-5" aria-hidden /> : <Timer className="size-5" aria-hidden />}
              {m.label}
            </button>
          ))}
        </div>
        <p className="flex items-center justify-center gap-2 text-sm text-ink-2">
          <Trophy className="size-4 text-accent" aria-hidden /> Best: <span className="font-semibold tabular">{best}</span>
        </p>
        <Button variant="primary" size="lg" className="w-full" onClick={start}>
          <Play className="size-5" aria-hidden /> Start
        </Button>
      </Card>
    );
  }

  if (phase === "over") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="space-y-3 p-6 text-center">
          <p className="text-sm text-ink-3">Score</p>
          <p className="font-serif text-6xl font-semibold tabular">{score}</p>
          {record ? (
            <p className="flex items-center justify-center gap-2 font-semibold text-accent">
              <Trophy className="size-5" aria-hidden /> New best!
            </p>
          ) : (
            <p className="text-sm text-ink-2">Best: {best}</p>
          )}
          <div className="flex justify-center gap-2">
            <Button variant="primary" onClick={start}>
              <RotateCcw className="size-4" aria-hidden /> Play again
            </Button>
            <Button onClick={() => setPhase("ready")}>Change mode</Button>
          </div>
        </Card>
        <Card className="p-3">
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {attempts.map((a, i) => (
              <li key={`${a.puzzle.puzzle.id}-${i}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-2">
                {a.solved ? <Check className="size-4 text-good" aria-label="Solved" /> : <X className="size-4 text-bad" aria-label="Missed" />}
                <span className="tabular text-ink-2">#{i + 1}</span>
                <span className="font-mono text-xs text-ink-3">{a.puzzle.puzzle.rating}</span>
                <span className="font-mono text-xs">{uciToSan(a.puzzle.startFen, a.puzzle.solution[0]) ?? ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <div className="flex min-h-0 flex-col items-center">
        <div className={cx("w-full max-w-[min(100%,calc(100dvh-12rem))] rounded-lg transition-shadow", flash === "good" && "ring-4 ring-good", flash === "bad" && "ring-4 ring-bad")}>
          {current ? (
            <Board
              fen={fen}
              orientation={current.solver === "w" ? "white" : "black"}
              lastMove={lastMove}
              onMove={onMove}
              movableColor={current.solver}
              interactive={fen.split(" ")[1] === current.solver}
              ariaLabel="Puzzle Rush board"
            />
          ) : null}
        </div>
      </div>
      <div className="space-y-3">
        <Card className="space-y-4 p-4" aria-live="polite">
          {remaining !== null ? (
            <p className={cx("text-center font-mono text-5xl font-semibold tabular", remaining < 20 && "text-bad")}>{fmt(remaining)}</p>
          ) : (
            <p className="text-center text-sm font-semibold text-ink-2">Survival</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-3">Score</span>
            <span className="font-serif text-4xl font-semibold tabular">{score}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-3">Mistakes</span>
            <span className="flex gap-1" aria-label={`${strikes} of ${RUSH_STRIKES} mistakes`}>
              {Array.from({ length: RUSH_STRIKES }).map((_, i) => (
                <X key={i} className={cx("size-6", i < strikes ? "text-bad" : "text-ink-3/30")} aria-hidden />
              ))}
            </span>
          </div>
          {current ? (
            <p className="text-center text-xs text-ink-3">
              {current.solver === "w" ? "White" : "Black"} to move · rating {current.puzzle.rating}
            </p>
          ) : null}
        </Card>
        <Button variant="ghost" size="sm" onClick={() => finish(attempts)}>
          End run
        </Button>
      </div>
    </div>
  );
}
