"use client";

import { Chess } from "chess.js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlipVertical2, Pause, Play, RotateCcw, Search, SkipForward } from "lucide-react";
import { EvalBar } from "@/components/analysis/EvalBar";
import { Board } from "@/components/board/Board";
import { Alert, Button, Card, SectionTitle, Spinner, Toggle, cx } from "@/components/ui/primitives";
import { useEngine } from "@/hooks/useEngine";
import { useSound } from "@/hooks/useSound";
import { applyUci } from "@/lib/chess/line";
import { parseSingleGame } from "@/lib/chess/pgn";
import { isThreefoldRepetition } from "@/lib/chess/repetition";
import { START_FEN } from "@/lib/chess/types";
import type { Score } from "@/lib/engine/score";
import { PLAY_LEVELS, type PlayLevel, chooseBotMove } from "@/lib/play";
import { StorageError, saveGame } from "@/lib/storage/db";

type Side = "w" | "b";
type Phase = "setup" | "match";

/** Pause between moves, in seconds, so the game can be followed. */
const DELAYS = [0, 1, 2, 3, 5, 8, 10] as const;
const DEFAULT_DELAY = 5;
const FIRST_MOVE_WAIT_MS = 1000;
/** Safety stop for two engines that shuffle forever. */
const MAX_PLIES = 400;
/** Opening variety: for these first plies pick among the engine's best few moves instead of always the best. */
const VARIETY_PLIES = 10;
const VARIETY_OPTIONS = { varietyTopK: 3, varietyMaxLossCp: 40 } as const;
const MAX_LEVEL = PLAY_LEVELS[PLAY_LEVELS.length - 1].level;
const WATCH_PARAM = "watching";

const levelOf = (n: number): PlayLevel => PLAY_LEVELS.find((l) => l.level === n) ?? PLAY_LEVELS[PLAY_LEVELS.length - 1];
const delayLabel = (s: number) => (s === 0 ? "Off" : `${s} s`);
const nameOf = (l: PlayLevel) => `${l.name} (${l.rating})`;

function replay(moves: string[]): { fen: string; sans: string[]; last: { from: string; to: string } | null } {
  const chess = new Chess(START_FEN);
  const sans: string[] = [];
  let last: { from: string; to: string } | null = null;
  for (const uci of moves) {
    const m = applyUci(chess, uci);
    if (!m) break;
    sans.push(m.san);
    last = { from: m.from, to: m.to };
  }
  return { fen: chess.fen(), sans, last };
}

type Outcome = { result: "1-0" | "0-1" | "1/2-1/2"; text: string };

/** `repeated` comes from the move list: a position rebuilt from a FEN has no history to repeat. */
function outcomeOf(fen: string, plies: number, repeated: boolean): Outcome | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return c.turn() === "w" ? { result: "0-1", text: "Black wins by checkmate." } : { result: "1-0", text: "White wins by checkmate." };
  if (c.isStalemate()) return { result: "1/2-1/2", text: "Draw by stalemate." };
  if (c.isInsufficientMaterial()) return { result: "1/2-1/2", text: "Draw: not enough material to win." };
  if (repeated) return { result: "1/2-1/2", text: "Draw by threefold repetition." };
  if (c.isDrawByFiftyMoves()) return { result: "1/2-1/2", text: "Draw by the fifty-move rule." };
  if (plies >= MAX_PLIES) return { result: "1/2-1/2", text: `Stopped after ${MAX_PLIES / 2} moves: counted as a draw.` };
  return null;
}

/** Strength picker: the same bot tiles as the Play screen. */
function LevelPicker({ label, value, onChange }: { label: string; value: number; onChange: (level: number) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={label}>
        {PLAY_LEVELS.map((b) => (
          <button
            key={b.level}
            type="button"
            role="radio"
            aria-checked={value === b.level}
            onClick={() => onChange(b.level)}
            title={b.label}
            className={cx(
              "flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors",
              value === b.level ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.avatar} alt="" className="size-12 rounded-full" draggable={false} />
            <span className="text-sm font-semibold leading-tight">{b.name}</span>
            <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular", value === b.level ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2")}>
              {b.rating}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Watch two Stockfish engines play each other, at strengths and with a pause between moves that you choose.
 * While a match runs it takes over the screen (like the other games) and Back returns to the setup.
 */
export function EngineMatch({ onActiveChange }: { onActiveChange?: (active: boolean) => void } = {}) {
  const router = useRouter();
  const sound = useSound();
  const engine = useEngine();
  const { load } = engine;
  const [phase, setPhase] = useState<Phase>("setup");
  const [whiteLevel, setWhiteLevel] = useState(MAX_LEVEL);
  const [blackLevel, setBlackLevel] = useState(MAX_LEVEL);
  const [delaySec, setDelaySec] = useState<number>(DEFAULT_DELAY);
  const [variety, setVariety] = useState(true);
  const [moves, setMoves] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState<Score | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState(0);
  const skipWait = useRef(false);

  const { fen, sans, last } = useMemo(() => replay(moves), [moves]);
  const turn: Side = fen.split(" ")[1] === "b" ? "b" : "w";
  const repeated = useMemo(() => isThreefoldRepetition(moves), [moves]);
  const over = useMemo(() => outcomeOf(fen, moves.length, repeated), [fen, moves.length, repeated]);
  const lastSan = sans[sans.length - 1];
  const engineReady = engine.status.state === "ready";

  // Tell the Play screen when a match is running so it can hide the mode cards.
  useEffect(() => {
    onActiveChange?.(phase === "match");
  }, [phase, onActiveChange]);
  useEffect(() => () => onActiveChange?.(false), [onActiveChange]);

  const toSetup = () => {
    setPhase("setup");
    setMoves([]);
    setPaused(false);
    setError(null);
    setScore(null);
  };

  // The browser's Back button leaves the match, like it leaves the other games.
  useEffect(() => {
    const onPop = () => {
      if (new URLSearchParams(window.location.search).get(WATCH_PARAM) !== "1") toSetup();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The match loop: for each move, think while the pause runs, then play it once both are done.
  useEffect(() => {
    if (phase !== "match" || paused || over || engine.status.state !== "ready") return;
    const eng = engine.status.engine;
    const cfg = levelOf(turn === "w" ? whiteLevel : blackLevel);
    const waitMs = skipWait.current ? 0 : moves.length === 0 ? FIRST_MOVE_WAIT_MS : delaySec * 1000;
    skipWait.current = false;
    const startedAt = Date.now();
    const ply = moves.length;
    let cancelled = false;
    const tick = () => {
      setNextIn(Math.max(0, Math.ceil((startedAt + waitMs - Date.now()) / 1000)));
      setProgress(waitMs === 0 ? 1 : Math.min(1, (Date.now() - startedAt) / waitMs));
    };
    tick();
    const timer = setInterval(tick, 100);
    void (async () => {
      try {
        const opts = variety && ply < VARIETY_PLIES ? VARIETY_OPTIONS : {};
        // Show the evaluation as soon as the engine has judged the position, not after the pause.
        const analysis = chooseBotMove(eng, fen, cfg, opts).then((p) => {
          if (!cancelled && p) setScore(p.score);
          return p;
        });
        const [pick] = await Promise.all([analysis, new Promise<void>((r) => setTimeout(r, waitMs))]);
        if (cancelled) return;
        if (!pick) {
          setError("The engine could not find a move.");
          setPaused(true);
          return;
        }
        setMoves((m) => (m.length === ply ? [...m, pick.uci] : m));
      } catch {
        if (!cancelled) {
          setError("The engine stopped responding. Press Resume to try again.");
          setPaused(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      eng.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, over, engineReady, moves.length, fen, nudge, delaySec, whiteLevel, blackLevel, variety]);

  useEffect(() => {
    if (lastSan) sound.playSan(lastSan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSan, sans.length]);

  useEffect(() => {
    if (over) sound.play(over.result === "1/2-1/2" ? "draw" : "game-end");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over?.result]);

  const start = () => {
    setMoves([]);
    setPaused(false);
    setError(null);
    setScore(null);
    setNextIn(null);
    setProgress(0);
    // A history entry, so Back returns to the setup (as it does for the other games).
    const url = new URL(window.location.href);
    url.searchParams.set(WATCH_PARAM, "1");
    window.history.pushState(window.history.state, "", url);
    setPhase("match");
    void load();
  };

  const newMatch = () => {
    if (new URLSearchParams(window.location.search).get(WATCH_PARAM) === "1") window.history.back();
    else toSetup();
  };

  const nextNow = () => {
    skipWait.current = true;
    setNudge((n) => n + 1);
  };

  const pgn = () => {
    const c = new Chess();
    for (const uci of moves) applyUci(c, uci);
    c.setHeader("Event", "Tempo: engine match");
    c.setHeader("White", nameOf(levelOf(whiteLevel)));
    c.setHeader("Black", nameOf(levelOf(blackLevel)));
    c.setHeader("Date", new Date().toISOString().slice(0, 10).replace(/-/g, "."));
    c.setHeader("Result", over?.result ?? "*");
    return c.pgn();
  };

  const reviewGame = async () => {
    // Open the tab inside the click so popup blockers allow it.
    const tab = window.open("", "_blank");
    try {
      const game = parseSingleGame(pgn());
      await saveGame(game);
      const url = `/analyze?game=${encodeURIComponent(game.id)}`;
      if (tab) tab.location.href = url;
      else router.push(url);
    } catch (err) {
      tab?.close();
      setError(err instanceof StorageError ? err.message : "Could not open the game for review.");
    }
  };

  // ---- setup ------------------------------------------------------------------------------------
  if (phase === "setup") {
    return (
      <Card className="space-y-4 p-5">
        <LevelPicker label="White engine" value={whiteLevel} onChange={setWhiteLevel} />
        <LevelPicker label="Black engine" value={blackLevel} onChange={setBlackLevel} />
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Pause between moves</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="radiogroup" aria-label="Pause between moves">
            {DELAYS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={delaySec === s}
                onClick={() => setDelaySec(s)}
                className={cx(
                  "rounded-xl border px-1 py-2 text-center text-sm font-semibold transition-colors",
                  delaySec === s ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
                )}
              >
                {delayLabel(s)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-3">You can change this while the match is running.</p>
        </fieldset>
        <Toggle
          label="Vary the opening"
          description="Engines are deterministic, so two of the same strength would play the same game every time. This picks among their best few moves for the first five moves each, so every match is different."
          checked={variety}
          onChange={setVariety}
        />
        <Button variant="primary" size="lg" className="w-full" onClick={start}>
          <Play className="mr-1.5 size-5" aria-hidden /> Start match
        </Button>
      </Card>
    );
  }

  // ---- match ------------------------------------------------------------------------------------
  const white = levelOf(whiteLevel);
  const black = levelOf(blackLevel);
  const topSide: Side = flipped ? "w" : "b";
  const bottomSide: Side = flipped ? "b" : "w";
  const strip = (side: Side) => {
    const l = side === "w" ? white : black;
    const thinking = !over && !paused && turn === side && engineReady;
    return (
      <div className="flex items-center justify-between gap-2 px-1 py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={l.avatar} alt="" className="size-7 shrink-0 rounded-full" draggable={false} />
          <span className="inline-block size-3.5 shrink-0 rounded-sm border border-border" style={{ background: side === "w" ? "var(--eval-white)" : "var(--eval-black)" }} aria-hidden />
          <span className="truncate text-sm font-semibold">{nameOf(l)}</span>
          {thinking ? <span className="rounded bg-accent-soft px-1.5 text-[11px] font-medium text-accent">to move</span> : null}
        </span>
      </div>
    );
  };

  const lines: string[] = [];
  for (let i = 0; i < sans.length; i += 2) lines.push(`${i / 2 + 1}. ${sans[i]}${sans[i + 1] ? ` ${sans[i + 1]}` : ""}`);

  const status = over
    ? over.text
    : paused
      ? "Paused"
      : !engineReady
        ? "Loading Stockfish…"
        : nextIn !== null && nextIn > 0
          ? `${turn === "w" ? "White" : "Black"} plays in ${nextIn} s`
          : `${turn === "w" ? "White" : "Black"} is thinking…`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-10rem))]">
        {strip(topSide)}
        <div className="flex gap-2">
          <EvalBar score={score} orientation={flipped ? "black" : "white"} terminal={over ? (over.result === "1-0" ? "w" : over.result === "0-1" ? "b" : "draw") : null} />
          <div className="min-w-0 flex-1">
            <Board fen={fen} orientation={flipped ? "black" : "white"} lastMove={last} interactive={false} id="tempo-engine-match" ariaLabel="Engine match board" />
          </div>
        </div>
        {strip(bottomSide)}
      </div>

      <Card className="h-fit space-y-4 p-4">
        <div>
          <SectionTitle>Engine match</SectionTitle>
          <p className="mt-1 text-sm font-medium" role="status" aria-live="polite">
            {status}
          </p>
          {!over && !paused && engineReady ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="h-full rounded-full bg-accent transition-[width] duration-100 ease-linear" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          ) : null}
          {!engineReady && engine.status.state === "loading" ? <Spinner label="Starting the engine…" /> : null}
        </div>

        {engine.status.state === "error" ? (
          <Alert tone="error" title="Engine unavailable" action={<Button size="sm" onClick={() => void engine.retry()}>Retry</Button>}>
            {engine.status.message}
          </Alert>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="flex flex-wrap gap-2">
          {!over ? (
            <Button variant="primary" onClick={() => (error ? (setError(null), setPaused(false)) : setPaused((p) => !p))}>
              {paused ? <Play className="mr-1.5 size-4" aria-hidden /> : <Pause className="mr-1.5 size-4" aria-hidden />} {paused ? "Resume" : "Pause"}
            </Button>
          ) : null}
          {!over ? (
            <Button onClick={nextNow} disabled={paused || !engineReady}>
              <SkipForward className="mr-1.5 size-4" aria-hidden /> Next move now
            </Button>
          ) : null}
          <Button onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
            <FlipVertical2 className="mr-1.5 size-4" aria-hidden /> Flip
          </Button>
        </div>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Pause between moves</span>
          <select
            aria-label="Pause between moves"
            value={delaySec}
            onChange={(e) => setDelaySec(Number(e.target.value))}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink"
          >
            {DELAYS.map((s) => (
              <option key={s} value={s}>
                {delayLabel(s)}
              </option>
            ))}
          </select>
        </label>

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Moves</h3>
          <ol className="max-h-48 overflow-y-auto font-mono text-sm" aria-label="Moves">
            {lines.length === 0 ? <li className="text-ink-3">No moves yet.</li> : lines.map((l) => <li key={l}>{l}</li>)}
          </ol>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={reviewGame} disabled={moves.length < 2}>
            <Search className="mr-1.5 size-4" aria-hidden /> Review this game
          </Button>
          <Button variant="ghost" onClick={newMatch}>
            <RotateCcw className="mr-1.5 size-4" aria-hidden /> New match
          </Button>
        </div>
      </Card>
    </div>
  );
}
