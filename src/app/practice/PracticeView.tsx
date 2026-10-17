"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Eye, Lightbulb, RotateCcw, SkipForward, Timer } from "lucide-react";
import { Board, type BoardArrow } from "@/components/board/Board";
import { Alert, Button, Card, Spinner, cx, inputClass } from "@/components/ui/primitives";
import { useSound } from "@/hooks/useSound";
import { applyUci, parseUci, uciToSan } from "@/lib/chess/line";
import { pieceHint } from "@/lib/coach";
import {
  LEVELS,
  type PreparedPuzzle,
  type Puzzle,
  THEME_LABEL,
  isCorrectMove,
  loadPuzzles,
  matching,
  pickRandom,
  preparePuzzle,
  themeOptions,
} from "@/lib/puzzles";
import { setQuery } from "@/lib/url";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";

type Status = "setup" | "solving" | "wrong" | "solved" | "revealed";

/** Themes too generic (or about the game phase) to be a useful clue. */
const NON_CLUE_THEMES = new Set(["opening", "middlegame", "endgame", "advantage", "crushing", "equality", "mate"]);

type LevelId = (typeof LEVELS)[number]["id"];

export function PracticeView({ initialLevel, initialTheme, initialId }: { initialLevel?: string | null; initialTheme?: string | null; initialId?: string | null }) {
  const sound = useSound();
  const [all, setAll] = useState<Puzzle[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [levelId, setLevelIdState] = useState<LevelId>(() => LEVELS.find((l) => l.id === initialLevel)?.id ?? "intermediate");
  const [theme, setThemeState] = useState<string>(initialTheme ?? "");
  const setLevelId = (id: LevelId) => {
    setLevelIdState(id);
    setQuery({ level: id });
  };
  const setTheme = (t: string) => {
    setThemeState(t);
    setQuery({ theme: t || null });
  };
  const [current, setCurrent] = useState<PreparedPuzzle | null>(null);
  const sharedId = useRef<string | null>(initialId ?? null);
  const [fen, setFen] = useState<string>("");
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>("setup");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  /** 0 = none, 1 = piece highlighted + clue. */
  const [hint, setHint] = useState(0);
  const [wrongUci, setWrongUci] = useState<string | null>(null);
  const [session, setSession] = useState({ solved: 0, attempted: 0, streak: 0 });
  const [firstTry, setFirstTry] = useState(true);
  // Per-puzzle stopwatch (performance.now() timestamps).
  const [timer, setTimer] = useState<{ start: number | null; stop: number | null }>({ start: null, stop: null });
  const [now, setNow] = useState(0);
  const stopTimer = () => setTimer((t) => (t.start !== null && t.stop === null ? { ...t, stop: performance.now() } : t));

  useEffect(() => {
    if (timer.start === null || timer.stop !== null) return;
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [timer]);
  const seen = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    loadPuzzles().then(setAll, () => setLoadError(true));
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[1];
  const pool = useMemo(() => (all ? matching(all, { min: level.min, max: level.max, theme: theme || null }) : []), [all, level, theme]);
  const themes = useMemo(() => (all ? themeOptions(all) : []), [all]);

  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const next = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    // A shared link opens that exact puzzle first, whatever the filters.
    const shared = sharedId.current ? all?.find((x) => x.id === sharedId.current) : undefined;
    sharedId.current = null;
    const p = shared ?? pickRandom(pool, seen.current);
    const prepared = p ? preparePuzzle(p) : null;
    if (!prepared) {
      setCurrent(null);
      return;
    }
    seen.current.add(prepared.puzzle.id);
    setQuery({ id: prepared.puzzle.id });
    setCurrent(prepared);
    setFen(prepared.setupFen);
    setLastMove(null);
    setStep(0);
    setHint(0);
    setWrongUci(null);
    setFirstTry(true);
    setTimer({ start: null, stop: null });
    setStatus("setup");
    // Show the opponent's last move, then hand over to the solver.
    later(() => {
      const p = parseUci(prepared.setupMove);
      setFen(prepared.startFen);
      if (p) setLastMove({ from: p.from, to: p.to });
      const san = uciToSan(prepared.setupFen, prepared.setupMove);
      if (san) sound.playSan(san);
      const t0 = performance.now();
      setNow(t0);
      setTimer({ start: t0, stop: null });
      setStatus("solving");
    }, 600);
  }, [pool, sound, all]);

  // Start (and restart when filters change).
  useEffect(() => {
    if (!all) return;
    const t = setTimeout(next, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, levelId, theme]);

  const playUci = (fromFen: string, uci: string) => {
    const c = new Chess(fromFen);
    const m = applyUci(c, uci);
    if (!m) return null;
    setFen(c.fen());
    setLastMove({ from: m.from, to: m.to });
    sound.playSan(m.san);
    return c.fen();
  };

  const onMove = (uci: string): boolean => {
    if (!current || (status !== "solving" && status !== "wrong")) return false;
    const correct = isCorrectMove(fen, current.solution, step, uci);
    if (!correct) {
      setWrongUci(uci);
      setStatus("wrong");
      if (firstTry) {
        setFirstTry(false);
        setSession((s) => ({ ...s, attempted: s.attempted + 1, streak: 0 }));
      }
      sound.play("incorrect");
      return false;
    }
    setWrongUci(null);
    setHint(0);
    const after = playUci(fen, uci);
    if (!after) return false;
    const nextStep = step + 1;
    const finished = nextStep >= current.solution.length || new Chess(after).isGameOver();
    if (finished) {
      setStatus("solved");
      stopTimer();
      if (firstTry) setSession((s) => ({ solved: s.solved + 1, attempted: s.attempted + 1, streak: s.streak + 1 }));
      later(() => sound.play("correct"), 150);
      return true;
    }
    setStatus("solving");
    // Opponent's reply.
    later(() => {
      const reply = current.solution[nextStep];
      playUci(after, reply);
      setStep(nextStep + 1);
    }, 450);
    setStep(nextStep);
    return true;
  };

  const reveal = () => {
    if (!current) return;
    if (firstTry) {
      setFirstTry(false);
      setSession((s) => ({ ...s, attempted: s.attempted + 1, streak: 0 }));
    }
    setStatus("revealed");
    stopTimer();
    setHint(0);
    let f = fen;
    current.solution.slice(step).forEach((uci, i) => {
      later(() => {
        const nf = playUci(f, uci);
        if (nf) f = nf;
      }, 500 * (i + 1));
    });
  };

  const retry = () => {
    if (!current) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFen(current.startFen);
    const p = parseUci(current.setupMove);
    setLastMove(p ? { from: p.from, to: p.to } : null);
    setStep(0);
    setWrongUci(null);
    setHint(0);
    setStatus("solving");
  };

  if (loadError) return <Alert tone="error">Puzzles could not be loaded. Please reload the page.</Alert>;
  if (!all) return <Spinner label="Loading puzzles…" />;

  const expected = current && (status === "solving" || status === "wrong") ? current.solution[step] : null;
  const hintSquare = hint >= 1 && expected ? parseUci(expected)?.from : null;
  const wrong = wrongUci ? parseUci(wrongUci) : null;
  const highlights: Record<string, "good" | "bad" | "hint"> = {};
  if (hintSquare) highlights[hintSquare] = "hint";
  if (wrong && status === "wrong") highlights[wrong.to] = "bad";
  const arrows: BoardArrow[] = [];
  const pieceClue = hint >= 1 && expected ? pieceHint(fen, expected) : null;
  const themeClue = current?.puzzle.themes.find((t) => !NON_CLUE_THEMES.has(t) && THEME_LABEL[t]);

  const toMove = current ? (current.solver === "w" ? "White" : "Black") : "";

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <div className="flex min-h-0 flex-col items-center">
        <div className="w-full max-w-[min(100%,calc(100dvh-12rem))]">
          {current ? (
            <Board
              fen={fen || current.setupFen}
              orientation={current.solver === "w" ? "white" : "black"}
              lastMove={lastMove}
              onMove={onMove}
              movableColor={current.solver}
              interactive={status === "solving" || status === "wrong"}
              highlights={highlights}
              arrows={arrows}
              ariaLabel="Puzzle board"
            />
          ) : (
            <Alert tone="info">No puzzles match these filters. Try another level or theme.</Alert>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Card className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Level
              <select className={inputClass} value={levelId} onChange={(e) => setLevelId(e.target.value as LevelId)}>
                {LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Theme
              <select className={inputClass} value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="">All themes</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <dl className="grid grid-cols-3 text-center">
            <div><dt className="text-xs text-ink-3">Solved</dt><dd className="font-serif text-2xl tabular">{session.solved}</dd></div>
            <div><dt className="text-xs text-ink-3">Tried</dt><dd className="font-serif text-2xl tabular">{session.attempted}</dd></div>
            <div><dt className="text-xs text-ink-3">Streak</dt><dd className="font-serif text-2xl tabular">{session.streak}</dd></div>
          </dl>
        </Card>

        {current ? (
          <Card className="space-y-3 p-4" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Puzzle</span>
              <span className="ml-auto">
                <CopyLinkButton />
              </span>
              <span
                className={cx(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs tabular",
                  timer.stop !== null ? "bg-surface-2 text-ink-2" : "bg-ink text-bg",
                )}
                aria-label="Time on this puzzle"
              >
                <Timer className="size-3.5" aria-hidden />
                {(() => {
                  const ms = timer.start === null ? 0 : Math.max(0, (timer.stop ?? Math.max(now, timer.start)) - timer.start);
                  const sec = Math.floor(ms / 1000);
                  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
                })()}
              </span>
            </div>
            {status === "setup" ? (
              <p className="text-sm text-ink-2">Watch your opponent&apos;s move…</p>
            ) : status === "solving" ? (
              <p className="font-semibold">
                <span className={cx("mr-2 inline-block size-3 rounded-sm border border-border align-middle")} style={{ background: current.solver === "w" ? "var(--eval-white)" : "var(--eval-black)" }} aria-hidden />
                {toMove} to move — find the best move
              </p>
            ) : status === "wrong" ? (
              <Alert tone="warning" title="Not quite — try again" />
            ) : status === "solved" ? (
              <Alert tone="success" title={firstTry ? "Solved!" : "Solved"} />
            ) : (
              <Alert tone="info" title="Solution" />
            )}

            {(status === "solving" || status === "wrong") && pieceClue ? (
              <Alert tone="info">
                {pieceClue.text}
                {themeClue ? <span className="block">Idea: {THEME_LABEL[themeClue]}</span> : null}
              </Alert>
            ) : null}

            {status === "solved" || status === "revealed" ? (
              <p className="text-xs text-ink-3">
                Rating {current.puzzle.rating}
                {current.puzzle.themes.length ? ` · ${current.puzzle.themes.map((t) => THEME_LABEL[t] ?? t).slice(0, 4).join(", ")}` : ""}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {status === "solving" || status === "wrong" ? (
                <>
                  <Button size="sm" onClick={() => setHint(1)} disabled={hint >= 1}>
                    <Lightbulb className="size-4" aria-hidden /> Hint
                  </Button>
                  <Button size="sm" onClick={reveal}>
                    <Eye className="size-4" aria-hidden /> Solution
                  </Button>
                </>
              ) : null}
              {status === "revealed" || (status === "solved" && !firstTry) ? (
                <Button size="sm" onClick={retry}>
                  <RotateCcw className="size-4" aria-hidden /> Retry
                </Button>
              ) : null}
              <Button size="sm" variant={status === "solved" || status === "revealed" ? "primary" : "secondary"} onClick={next}>
                <SkipForward className="size-4" aria-hidden /> Next puzzle
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
