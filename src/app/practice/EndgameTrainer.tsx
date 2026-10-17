"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, validateFen } from "chess.js";
import { ArrowLeft, Lightbulb, RotateCcw, Undo2 } from "lucide-react";
import { ModeToggle } from "@/components/board/ModeToggle";
import { StepControls } from "@/components/board/StepControls";
import { Board, type BoardArrow } from "@/components/board/Board";
import { Alert, Button, Card, IconButton, Spinner } from "@/components/ui/primitives";
import { useSound } from "@/hooks/useSound";
import { applyUci } from "@/lib/chess/line";
import { ENDGAME_LESSONS, type EndgameLesson, isWorse, lessonById, mistakeText } from "@/lib/endgames";
import { type Outcome, fetchTablebase, outcomeOf, tablebaseApplies } from "@/lib/tablebase";
import { setQuery } from "@/lib/url";

/** A position from the board editor, trained like a lesson. */
function customLesson(fen: string): EndgameLesson | null {
  if (!validateFen(fen).ok || !tablebaseApplies(fen)) return null;
  return { id: "custom", title: "Your position", group: "Basic mates", goal: "win", fen, tip: "Play the best moves against perfect defence." };
}

type Status = "loading" | "your-move" | "thinking" | "mistake" | "won" | "held" | "lost" | "error";

interface DemoPly {
  fen: string;
  from: string;
  to: string;
  san: string;
  promotion: boolean;
}

export function EndgameTrainer({ initialLesson, initialFen }: { initialLesson?: string | null; initialFen?: string | null }) {
  const [lesson, setLesson] = useState<EndgameLesson | null>(() => lessonById(initialLesson) ?? (initialFen ? customLesson(initialFen) : null));

  const open = (l: EndgameLesson | null) => {
    setLesson(l);
    setQuery({ lesson: l && l.id !== "custom" ? l.id : null, fen: l?.id === "custom" ? l.fen : null });
  };

  if (!lesson) {
    const groups = [...new Set(ENDGAME_LESSONS.map((l) => l.group))];
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        {groups.map((g) => (
          <section key={g} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{g}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ENDGAME_LESSONS.filter((l) => l.group === g).map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => open(l)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                  >
                    <span>
                      <span className="block font-semibold">{l.title}</span>
                      <span className="text-xs text-ink-3">{l.goal === "win" ? "Win it" : "Hold the draw"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return <Trainer key={lesson.id + lesson.fen} lesson={lesson} onBack={() => open(null)} />;
}

function Trainer({ lesson, onBack }: { lesson: EndgameLesson; onBack: () => void }) {
  const sound = useSound();
  const userColor = lesson.fen.split(" ")[1] === "b" ? "b" : "w";
  const [fen, setFen] = useState(lesson.fen);
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [goal, setGoal] = useState<Outcome>(lesson.goal);
  const [baseline, setBaseline] = useState<Outcome>("unknown");
  const [best, setBest] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [moves, setMoves] = useState(0);
  const gen = useRef(0);
  const first = useRef(true);
  /** Watch mode: the bot's best line for both sides, recorded so it can be stepped through. */
  const [demo, setDemo] = useState<{ plies: DemoPly[]; idx: number; ended: boolean } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const extending = useRef(false);

  /** Look up the position with the user to move and hand over the turn. */
  const evaluateTurn = useCallback(
    async (f: string) => {
      const g = gen.current;
      setStatus("loading");
      try {
        const res = await fetchTablebase(f);
        if (g !== gen.current) return;
        const o = outcomeOf(res.category);
        setBaseline(o);
        setBest(res.moves[0]?.uci ?? null);
        if (first.current) {
          first.current = false;
          // Custom positions: the goal is whatever the position is worth.
          if (lesson.id === "custom") setGoal(o === "loss" ? "draw" : o);
        }
        setStatus("your-move");
      } catch {
        if (g === gen.current) setStatus("error");
      }
    },
    [lesson.id],
  );

  useEffect(() => {
    const t = setTimeout(() => void evaluateTurn(lesson.fen), 0);
    return () => clearTimeout(t);
  }, [evaluateTurn, lesson.fen]);

  const finish = (s: "won" | "held") => {
    setStatus(s);
    sound.play("victory");
  };

  const onMove = (uci: string): boolean => {
    if (status !== "your-move") return false;
    const c = new Chess(fen);
    const m = applyUci(c, uci);
    if (!m) return false;
    const before = fen;
    const after = c.fen();
    const g = ++gen.current;
    setHistory((h) => [...h, before]);
    setFen(after);
    setLastMove({ from: m.from, to: m.to });
    setHint(false);
    setMessage(null);
    sound.playSan(m.san);
    setStatus("thinking");
    const nextMoves = moves + 1;
    setMoves(nextMoves);

    const fail = (text: string) => {
      setMessage(text);
      setStatus("mistake");
      sound.play("incorrect");
    };

    if (c.isCheckmate()) {
      finish("won");
      return true;
    }
    if (c.isDraw()) {
      if (goal === "draw") finish("held");
      else fail(c.isStalemate() ? "Stalemate! The king has no moves, so the game is drawn." : "The game is drawn — the win is gone.");
      return true;
    }

    void (async () => {
      try {
        const res = await fetchTablebase(after);
        if (g !== gen.current) return;
        const forUser: Outcome = ((o) => (o === "win" ? "loss" : o === "loss" ? "win" : o))(outcomeOf(res.category));
        if (isWorse(baseline, forUser)) {
          fail(mistakeText(baseline, forUser));
          return;
        }
        if (lesson.untilPromotion && m.promotion && forUser === "win") {
          finish("won");
          return;
        }
        if (goal === "draw" && nextMoves >= (lesson.holdMoves ?? 20)) {
          finish("held");
          return;
        }
        const reply = res.moves[0]?.uci;
        if (!reply) return;
        setTimeout(() => {
          if (g !== gen.current) return;
          const r = new Chess(after);
          const rm = applyUci(r, reply);
          if (!rm) return;
          setFen(r.fen());
          setLastMove({ from: rm.from, to: rm.to });
          sound.playSan(rm.san);
          if (r.isCheckmate()) {
            setStatus("lost");
            setMessage("You were checkmated.");
            sound.play("defeat");
          } else if (r.isDraw()) {
            if (goal === "draw") finish("held");
            else fail("The game is drawn — the win is gone.");
          } else void evaluateTurn(r.fen());
        }, 350);
      } catch {
        if (g === gen.current) setStatus("error");
      }
    })();
    return true;
  };

  // ---- Watch mode -------------------------------------------------------------
  const demoFen = demo ? (demo.idx === 0 ? lesson.fen : demo.plies[demo.idx - 1].fen) : null;

  /** Is the demo line finished after these plies? */
  const lineEnded = useCallback(
    (plies: DemoPly[]) => {
      const f = plies.length ? plies[plies.length - 1].fen : lesson.fen;
      const c = new Chess(f);
      const limit = lesson.goal === "draw" ? (lesson.holdMoves ?? 20) * 2 : 200;
      return c.isGameOver() || (!!lesson.untilPromotion && !!plies[plies.length - 1]?.promotion) || plies.length >= limit;
    },
    [lesson],
  );

  /** Step forward: replay a recorded move, or look up the next best move. */
  const demoNext = useCallback(async () => {
    if (!demo) return;
    if (demo.idx < demo.plies.length) {
      sound.playSan(demo.plies[demo.idx].san);
      setDemo({ ...demo, idx: demo.idx + 1 });
      return;
    }
    if (demo.ended || extending.current) return;
    extending.current = true;
    try {
      const from = demo.plies.length ? demo.plies[demo.plies.length - 1].fen : lesson.fen;
      const res = await fetchTablebase(from);
      const uci = res.moves[0]?.uci;
      const r = new Chess(from);
      const m = uci ? applyUci(r, uci) : null;
      if (!m) {
        setDemo({ ...demo, ended: true });
        return;
      }
      const plies = [...demo.plies, { fen: r.fen(), from: m.from, to: m.to, san: m.san, promotion: !!m.promotion }];
      sound.playSan(m.san);
      setDemo({ plies, idx: plies.length, ended: lineEnded(plies) });
    } catch {
      setPlaying(false);
      setStatus("error");
    } finally {
      extending.current = false;
    }
  }, [demo, lesson.fen, lineEnded, sound]);

  const demoGo = (idx: number) => {
    if (!demo) return;
    setPlaying(false);
    setDemo({ ...demo, idx: Math.max(0, Math.min(demo.plies.length, idx)) });
  };

  // Autoplay through the line.
  useEffect(() => {
    if (!playing || !demo) return;
    if (demo.ended && demo.idx >= demo.plies.length) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => void demoNext(), speed * 1000);
    return () => clearTimeout(t);
  }, [playing, demo, speed, demoNext]);

  // Arrow keys / Space while watching.
  useEffect(() => {
    if (!demo) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") void demoNext();
      else if (e.key === "ArrowLeft") demoGo(demo.idx - 1);
      else if (e.key === "Home") demoGo(0);
      else if (e.key === "End") demoGo(demo.plies.length);
      else if (e.key === " ") setPlaying((p) => !p);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const startWatching = () => {
    gen.current++;
    setHint(false);
    setMessage(null);
    setDemo({ plies: [], idx: 0, ended: false });
    setPlaying(true);
  };

  /** Leave watch mode and play the lesson from the start. */
  const tryIt = () => {
    setDemo(null);
    setPlaying(false);
    restart();
  };

  const takeBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    gen.current++;
    setHistory((h) => h.slice(0, -1));
    setFen(prev);
    setLastMove(null);
    setMessage(null);
    setMoves((n) => Math.max(0, n - 1));
    void evaluateTurn(prev);
  };

  const restart = () => {
    gen.current++;
    setHistory([]);
    setFen(lesson.fen);
    setLastMove(null);
    setMessage(null);
    setMoves(0);
    setHint(false);
    void evaluateTurn(lesson.fen);
  };

  const arrows: BoardArrow[] = hint && best && status === "your-move" ? [{ from: best.slice(0, 2), to: best.slice(2, 4), kind: "best" }] : [];
  const goalText = goal === "draw" ? `Hold the draw for ${lesson.holdMoves ?? 20} moves` : lesson.untilPromotion ? "Win: promote safely" : "Win: deliver checkmate";
  const side = userColor === "w" ? "White" : "Black";

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <div className="flex min-h-0 flex-col items-center">
        <div className="w-full max-w-[min(100%,calc(100dvh-12rem))]">
          <Board
            fen={demoFen ?? fen}
            orientation={userColor === "w" ? "white" : "black"}
            lastMove={demo ? (demo.idx > 0 ? demo.plies[demo.idx - 1] : null) : lastMove}
            arrows={demo ? [] : arrows}
            onMove={onMove}
            movableColor={userColor}
            interactive={!demo && status === "your-move"}
            ariaLabel="Endgame board"
          />
          {demo ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <StepControls
                onFirst={() => demoGo(0)}
                onPrev={() => demoGo(demo.idx - 1)}
                onNext={() => {
                  setPlaying(false);
                  void demoNext();
                }}
                onLast={() => demoGo(demo.plies.length)}
                canPrev={demo.idx > 0}
                canNext={!(demo.ended && demo.idx >= demo.plies.length)}
                playing={playing}
                onTogglePlay={() => setPlaying((p) => !p)}
                speed={speed}
                onSpeed={setSpeed}
              />
              <p className="text-xs text-ink-3 tabular">
                {demo.idx === 0 ? "Start" : `Move ${demo.idx}`}
                {demo.ended && demo.idx >= demo.plies.length ? " · end of line" : ""}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <Card className="space-y-3 p-4" aria-live="polite">
          <div className="flex items-center gap-2">
            <IconButton label="All endgames" onClick={onBack}>
              <ArrowLeft className="size-5" aria-hidden />
            </IconButton>
            <div>
              <p className="font-semibold">{lesson.title}</p>
              <p className="text-xs text-ink-3">
                {side} · {goalText}
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-2">{lesson.tip}</p>
          <ModeToggle value={demo ? "watch" : "practice"} onChange={(m) => (m === "watch" ? startWatching() : tryIt())} />

          {demo ? (
            <p className="text-sm font-semibold">Perfect play for both sides</p>
          ) : status === "loading" || status === "thinking" ? (
            <Spinner label={status === "thinking" ? "Checking your move…" : "Looking up the position…"} />
          ) : status === "your-move" ? (
            <p className="font-semibold">Your move</p>

          ) : status === "mistake" ? (
            <Alert tone="warning" title="Not the right idea">
              {message}
            </Alert>
          ) : status === "won" ? (
            <Alert tone="success" title={lesson.untilPromotion ? "Promoted — you kept the win!" : "Checkmate — well done!"} />
          ) : status === "held" ? (
            <Alert tone="success" title="Draw held — well defended!" />
          ) : status === "lost" ? (
            <Alert tone="error" title="Lost">
              {message}
            </Alert>
          ) : (
            <Alert tone="error" title="Tablebase unavailable">
              The endgame trainer needs an internet connection.{" "}
              <button type="button" className="underline" onClick={() => void evaluateTurn(fen)}>
                Try again
              </button>
            </Alert>
          )}


          <div className="flex flex-wrap gap-2">
            {status === "mistake" || status === "lost" ? (
              <Button size="sm" variant="primary" onClick={takeBack}>
                <Undo2 className="size-4" aria-hidden /> Take back
              </Button>
            ) : null}
            {status === "your-move" ? (
              <Button size="sm" onClick={() => setHint(true)} disabled={hint || !best}>
                <Lightbulb className="size-4" aria-hidden /> Hint
              </Button>
            ) : null}
            {!demo ? (
              <Button size="sm" onClick={restart}>
                <RotateCcw className="size-4" aria-hidden /> Restart
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
