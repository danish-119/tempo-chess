"use client";

import { Chess } from "chess.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Flag, RotateCcw } from "lucide-react";
import { Board } from "@/components/board/Board";
import { Alert, Button, Card, SectionTitle, cx, inputClass } from "@/components/ui/primitives";
import { useEngine } from "@/hooks/useEngine";
import { useSound } from "@/hooks/useSound";
import { applyUci, terminalState } from "@/lib/chess/line";
import { START_FEN } from "@/lib/chess/types";
import { parseMoveInput, piecePlacementText } from "@/lib/blindfold";
import { PLAY_LEVELS, pickHumanMove } from "@/lib/play";
import { record as recordProgress } from "@/hooks/useProgress";
import { dateKey, recordActivity } from "@/lib/progress";

type Phase = "setup" | "playing" | "over";
const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";
const PEEK_MS = 3000;
/** Bots 1-8 only: the strongest ones are unfair when you cannot see the board. */
const LEVELS = PLAY_LEVELS.filter((l) => l.level <= 8);

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

/** Play a full game against a bot with the board hidden: type moves, listen to the replies. */
export function BlindfoldTrainer() {
  const sound = useSound();
  const engine = useEngine();
  const { load } = engine;
  const [phase, setPhase] = useState<Phase>("setup");
  const [level, setLevel] = useState(3);
  const [color, setColor] = useState<"w" | "b">("w");
  const [moves, setMoves] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [peeking, setPeeking] = useState(false);
  const [peeks, setPeeks] = useState(0);
  const [showText, setShowText] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [resigned, setResigned] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { fen, sans, last } = useMemo(() => replay(moves), [moves]);
  const turn = fen.split(" ")[1] === "w" ? "w" : "b";
  const myTurn = turn === color;
  const end = terminalState(fen);
  const cfg = LEVELS.find((l) => l.level === level) ?? LEVELS[2];

  const start = () => {
    setMoves([]);
    setInput("");
    setError(null);
    setPeeks(0);
    setPeeking(false);
    setShowText(false);
    setResigned(false);
    setPhase("playing");
    void load();
  };

  // Game over detection.
  useEffect(() => {
    if (phase !== "playing") return;
    if (end || resigned) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("over");
      sound.play(end === "checkmate" && !myTurn ? "victory" : "game-end");
      recordProgress((p) => recordActivity(p, dateKey()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, resigned, phase]);

  // Bot reply.
  useEffect(() => {
    if (phase !== "playing" || myTurn || end) return;
    if (engine.status.state !== "ready") return;
    const eng = engine.status.engine;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThinking(true);
    const timer = setTimeout(async () => {
      try {
        const snap = await eng.analyze({ fen, movetimeMs: cfg.movetimeMs, depth: cfg.depth, strength: cfg.strength, multiPv: cfg.humanize?.topK });
        if (cancelled) return;
        const legal = new Chess(fen).moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ""}`);
        const best = cfg.humanize
          ? pickHumanMove(snap.lines.map((l) => l.pv[0]).filter(Boolean), legal, cfg.humanize)
          : (snap.bestmove ?? snap.lines[0]?.pv[0]);
        if (best && applyUci(new Chess(fen), best)) {
          setMoves((m) => (m.length === moves.length ? [...m, best] : m));
        }
      } catch {
        if (!cancelled) setError("The engine stopped responding. Try again or start a new game.");
      } finally {
        if (!cancelled) setThinking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, myTurn, end, fen, engine.status.state]);

  // Play a sound for each new move.
  const lastSan = sans[sans.length - 1];
  useEffect(() => {
    if (lastSan) sound.playSan(lastSan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSan, sans.length]);

  useEffect(() => {
    if (phase === "playing" && myTurn) inputRef.current?.focus();
  }, [phase, myTurn, moves.length]);

  useEffect(
    () => () => {
      if (peekTimer.current) clearTimeout(peekTimer.current);
    },
    [],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTurn || thinking) return;
    const uci = parseMoveInput(fen, input);
    if (!uci) {
      setError(`"${input.trim()}" is not a legal move here. Try again, for example Nf3, e4 or O-O.`);
      return;
    }
    setError(null);
    setInput("");
    setMoves((m) => [...m, uci]);
  };

  const peek = () => {
    setPeeks((n) => n + 1);
    setPeeking(true);
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeeking(false), PEEK_MS);
  };

  const lines: string[] = [];
  for (let i = 0; i < sans.length; i += 2) lines.push(`${i / 2 + 1}. ${sans[i]}${sans[i + 1] ? ` ${sans[i + 1]}` : ""}`);
  const text = showText ? piecePlacementText(fen) : null;

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="space-y-4 p-5">
          <div>
            <SectionTitle className="mb-1">Blindfold chess</SectionTitle>
            <p className="text-sm text-ink-2">
              The board is hidden. Type your move (<span className="font-mono">Nf3</span>, <span className="font-mono">e4</span>, <span className="font-mono">O-O</span> or <span className="font-mono">e2e4</span>) and read the bot&apos;s reply in the move list. Peek costs nothing but shows how often you needed it.
            </p>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Opponent</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Opponent">
              {LEVELS.map((l) => (
                <button
                  key={l.level}
                  type="button"
                  role="radio"
                  aria-checked={level === l.level}
                  onClick={() => setLevel(l.level)}
                  className={cx("rounded-lg border p-2 text-left text-sm", level === l.level ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2")}
                >
                  <span className="block font-medium">{l.name}</span>
                  <span className="block text-xs text-ink-2">{l.rating}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">You play</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Your colour">
              {(["w", "b"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  onClick={() => setColor(c)}
                  className={cx("rounded-lg border px-3 py-1.5 text-sm font-medium", color === c ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2")}
                >
                  {c === "w" ? "White" : "Black"}
                </button>
              ))}
            </div>
          </fieldset>
          <Button variant="primary" size="lg" onClick={start}>
            Start blindfold game
          </Button>
        </Card>
      </div>
    );
  }

  const visible = peeking || phase === "over";
  const result =
    resigned
      ? "You resigned."
      : end === "checkmate"
        ? myTurn
          ? "Checkmate. You lost."
          : "Checkmate. You won!"
        : end === "stalemate"
          ? "Stalemate. It is a draw."
          : end
            ? "The game is drawn."
            : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-12rem))]">
        <Board
          fen={visible ? fen : EMPTY_FEN}
          orientation={color === "w" ? "white" : "black"}
          lastMove={visible ? last : null}
          interactive={false}
          id="tempo-blindfold"
          ariaLabel={visible ? "Blindfold board (visible)" : "Blindfold board (hidden)"}
        />
        {!visible ? <p className="mt-2 text-center text-sm text-ink-3">The pieces are hidden.</p> : null}
      </div>
      <Card className="h-fit space-y-4 p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>
            {cfg.name} <span className="text-ink-3">({cfg.rating})</span>
          </SectionTitle>
          <span className="text-xs text-ink-3">Peeks: {peeks}</span>
        </div>

        {result ? (
          <Alert tone={result.includes("won") ? "success" : "info"} title="Game over">
            {result} You peeked {peeks} {peeks === 1 ? "time" : "times"}.
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-2">
            <label htmlFor="blindfold-move" className="text-sm font-medium">
              {myTurn ? "Your move" : thinking ? `${cfg.name} is thinking…` : "Waiting for the engine…"}
            </label>
            <div className="flex gap-2">
              <input
                id="blindfold-move"
                ref={inputRef}
                className={inputClass}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!myTurn || thinking}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="e.g. Nf3"
                aria-invalid={error ? true : undefined}
              />
              <Button type="submit" variant="primary" disabled={!myTurn || thinking || !input.trim()}>
                Move
              </Button>
            </div>
          </form>
        )}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {engine.status.state === "error" ? <Alert tone="error" title="Engine unavailable">{engine.status.message}</Alert> : null}

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Moves</h3>
          <ol className="max-h-48 overflow-y-auto font-mono text-sm" aria-live="polite" aria-label="Move list">
            {lines.length === 0 ? <li className="text-ink-3">No moves yet.</li> : lines.map((l) => <li key={l}>{l}</li>)}
          </ol>
          {lastSan && phase === "playing" && myTurn ? (
            <p className="sr-only" role="status">
              {turn === "w" ? "Black" : "White"} played {lastSan}. Your move.
            </p>
          ) : null}
        </div>

        {text ? (
          <dl className="space-y-1 rounded-lg bg-surface-2 p-2 text-xs">
            <div>
              <dt className="font-semibold">White</dt>
              <dd className="text-ink-2">{text.white}</dd>
            </div>
            <div>
              <dt className="font-semibold">Black</dt>
              <dd className="text-ink-2">{text.black}</dd>
            </div>
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {phase === "playing" ? (
            <>
              <Button onClick={peek} disabled={peeking}>
                {peeking ? <EyeOff className="mr-1.5 size-4" aria-hidden /> : <Eye className="mr-1.5 size-4" aria-hidden />} Peek ({PEEK_MS / 1000}s)
              </Button>
              <Button onClick={() => setShowText((v) => !v)} aria-pressed={showText}>
                Piece list
              </Button>
              <Button variant="danger" onClick={() => setResigned(true)}>
                <Flag className="mr-1.5 size-4" aria-hidden /> Resign
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setPhase("setup")}>
              <RotateCcw className="mr-1.5 size-4" aria-hidden /> New game
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
