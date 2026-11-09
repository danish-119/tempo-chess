"use client";

import { MiniBoard } from "@/components/learn/MiniBoard";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lightbulb, Pause, Play, RotateCcw, Search, Swords } from "lucide-react";
import { ModeToggle } from "@/components/board/ModeToggle";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { Alert, Button, ButtonLink, Card, IconButton, cx } from "@/components/ui/primitives";
import { useCoachVoice, VoiceToggle } from "@/hooks/useCoachVoice";
import { useSound } from "@/hooks/useSound";
import { START_FEN } from "@/lib/chess/types";
import { OPENINGS, OPENING_GROUPS, type OpeningLesson, moveNarration, openingById } from "@/lib/learn/openings";
import { stopSpeaking } from "@/lib/speech";
import { setQuery } from "@/lib/url";
import { LineViewer, buildLine } from "../LineViewer";

/** The position each opening reaches after its main line, for the tiles. */
const OPENING_FENS: Record<string, string> = Object.fromEntries(
  OPENINGS.map((o) => {
    const line = buildLine(START_FEN, o.moves.split(" "));
    return [o.id, line[line.length - 1]?.fenAfter ?? START_FEN];
  }),
);

export function OpeningsView() {
  const params = useSearchParams();
  const [opening, setOpening] = useState<OpeningLesson | null>(() => openingById(params.get("o")));

  const open = (o: OpeningLesson | null) => {
    setOpening(o);
    setQuery({ o: o?.id ?? null });
    window.scrollTo({ top: 0 });
  };

  if (!opening) {
    return (
      <div className="space-y-8">
        {OPENING_GROUPS.map((g) => (
          <section key={g} className="space-y-3" aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className="eyebrow">
              {g}
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {OPENINGS.filter((o) => o.group === g).map((o, i) => (
                <li key={o.id} className="animate-[tile-pop_0.3s_ease-out_both]" style={{ animationDelay: `${i * 30}ms` }}>
                  <button
                    type="button"
                    onClick={() => open(o)}
                    className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-[var(--shadow)]"
                  >
                    <span className="block aspect-square w-full p-2.5 pb-0" aria-hidden>
                      <MiniBoard fen={OPENING_FENS[o.id]} className="!max-h-none !text-base sm:!text-lg" />
                    </span>
                    <span className="flex flex-1 flex-col gap-1 p-3">
                      <span className="font-semibold leading-tight group-hover:text-accent">{o.name}</span>
                      <span className="mt-auto flex items-center gap-2 text-xs text-ink-3">
                        <span className="font-mono">{o.eco}</span>
                        <span className={cx("inline-block size-2.5 rounded-full ring-1 ring-ink-3", o.side === "w" ? "bg-white" : "bg-black")} aria-hidden />
                        {o.side === "w" ? "White" : "Black"}
                      </span>
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

  return <OpeningLessonView key={opening.id} opening={opening} onBack={() => open(null)} />;
}

function OpeningLessonView({ opening, onBack }: { opening: OpeningLesson; onBack: () => void }) {
  const sound = useSound();
  const voice = useCoachVoice();
  const { say } = voice;
  const line = useMemo(() => buildLine(START_FEN, opening.moves.split(" ")), [opening.moves]);
  const [ply, setPly] = useState(0);
  const [mode, setMode] = useState<"watch" | "practice">("watch");
  const [feedback, setFeedback] = useState<"wrong" | "done" | null>(null);
  const [hint, setHint] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const mistakesRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Watching with the coach: each move is played, explained, and the next follows once the coach has finished. */
  const [guided, setGuided] = useState(false);
  const [narration, setNarration] = useState("");
  const run = useRef(0);
  const finalFen = line[line.length - 1].fenAfter;
  const yourTurn = (n: number) => (n % 2 === 0 ? "w" : "b") === opening.side;
  const side = opening.side === "w" ? "White" : "Black";

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => clearTimer(), []);

  /** Say a line, then carry on: after the voice finishes, or after a reading pause when the voice is off. */
  const sayThen = (text: string, next: () => void) => {
    const mine = run.current;
    let fired = false;
    const go = () => {
      if (fired || run.current !== mine) return;
      fired = true;
      clearTimer();
      timer.current = setTimeout(() => run.current === mine && next(), 500);
    };
    setNarration(text);
    // If a browser never reports the end of speech, carry on after a generous reading pause anyway.
    timer.current = setTimeout(go, voice.on ? 2500 + text.length * 90 : 900 + text.length * 40);
    if (voice.on) say(text, { onEnd: go });
  };

  const playMove = (n: number) => {
    if (n >= line.length) {
      sayThen(`That is the ${opening.name}. ${opening.summary}`, () => setGuided(false));
      return;
    }
    sound.playSan(line[n].san);
    setPly(n + 1);
    sayThen(moveNarration(opening, n + 1, line[n].san), () => playMove(n + 1));
  };

  const stopWatch = () => {
    run.current++;
    clearTimer();
    setGuided(false);
    stopSpeaking();
  };

  const startWatch = (from: number) => {
    run.current++;
    clearTimer();
    setMode("watch");
    setFeedback(null);
    setHint(false);
    setGuided(true);
    if (from === 0) {
      setPly(0);
      sayThen(`Let's watch the ${opening.name}. You play it as ${side}.`, () => playMove(0));
    } else playMove(from);
  };

  // Stepping through by hand: the coach explains the move now on the board.
  const stepRef = useRef(ply);
  useEffect(() => {
    if (guided || mode !== "watch" || stepRef.current === ply) {
      stepRef.current = ply;
      return;
    }
    stepRef.current = ply;
    const text = ply > 0 ? moveNarration(opening, ply, line[ply - 1].san) : "";
    const id = window.setTimeout(() => {
      setNarration(text);
      if (text) say(text);
    }, 0);
    return () => window.clearTimeout(id);
  }, [ply, guided, mode, opening, line, say]);

  /** What the practice box says; the coach says the same words. */
  const practiceLine = (f: typeof feedback, misses: number, yours: boolean) =>
    f === "done"
      ? misses === 0
        ? "Perfect. You know this line."
        : `You finished the line with ${misses} ${misses === 1 ? "mistake" : "mistakes"}.`
      : f === "wrong"
        ? "That is not the main line. Try again."
        : yours
          ? "Your move: play the main line."
          : "Your opponent is moving.";

  /** In practice mode, the opponent's moves play themselves. */
  const autoReply = (n: number) => {
    if (n < line.length && !yourTurn(n)) {
      timer.current = setTimeout(() => {
        sound.playSan(line[n].san);
        setPly(n + 1);
        if (n + 1 >= line.length) {
          setFeedback("done");
          say(practiceLine("done", mistakesRef.current, false));
        }
      }, 500);
    } else if (n >= line.length) {
      setFeedback("done");
      say(practiceLine("done", mistakesRef.current, false));
    }
  };

  const startPractice = () => {
    run.current++;
    clearTimer();
    setGuided(false);
    setMode("practice");
    setPly(0);
    setFeedback(null);
    setHint(false);
    setMistakes(0);
    mistakesRef.current = 0;
    say(`Now you play it. Make ${side}'s moves from the main line.`);
    autoReply(0);
  };

  const onMove = (uci: string): boolean => {
    if (mode !== "practice" || ply >= line.length || !yourTurn(ply)) return false;
    const expected = line[ply];
    if (uci !== expected.uci) {
      setFeedback("wrong");
      setMistakes((m) => m + 1);
      mistakesRef.current += 1;
      sound.play("incorrect");
      say(practiceLine("wrong", 0, true));
      return false;
    }
    sound.playSan(expected.san);
    setFeedback(null);
    setHint(false);
    setPly(ply + 1);
    autoReply(ply + 1);
    return true;
  };

  const expected = mode === "practice" && ply < line.length && yourTurn(ply) ? line[ply] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-14rem))]">
        <LineViewer
          startFen={START_FEN}
          line={line}
          ply={ply}
          setPly={setPly}
          orientation={opening.side === "w" ? "white" : "black"}
          interactive={mode === "practice" && !!expected}
          onMove={onMove}
          arrows={hint && expected ? [{ from: expected.from, to: expected.to, kind: "best" }] : []}
          ariaLabel={`${opening.name} board`}
          guide={{ playing: guided, toggle: () => (guided ? stopWatch() : startWatch(ply >= line.length ? 0 : ply)), stop: stopWatch }}
        />
      </div>

      <div className="space-y-3">
        <Card className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <IconButton label="All openings" onClick={onBack}>
              <ArrowLeft className="size-5" aria-hidden />
            </IconButton>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{opening.name}</p>
              <p className="text-xs text-ink-3">
                {opening.eco} · for {side}
              </p>
            </div>
            <VoiceToggle voice={voice} />
          </div>

          <ModeToggle
            value={mode}
            onChange={(m) => {
              if (m === "practice") startPractice();
              else startWatch(0);
            }}
          />

          {mode === "watch" ? (
            <>
              <p className="min-h-16 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2.5 text-sm leading-relaxed" role="status" aria-live="polite">
                {narration || "Press Watch, and the coach will play the moves and explain each one."}
              </p>
              <Button size="sm" variant={guided ? "secondary" : "primary"} onClick={() => (guided ? stopWatch() : startWatch(ply >= line.length ? 0 : ply))}>
                {guided ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />} {guided ? "Pause" : ply === 0 || ply >= line.length ? "Watch" : "Carry on"}
              </Button>
            </>
          ) : (
            <div aria-live="polite" className="space-y-3">
              {feedback === "done" ? (
                <Alert tone="success" title={practiceLine("done", mistakes, false)} />
              ) : feedback === "wrong" ? (
                <Alert tone="warning" title={practiceLine("wrong", 0, true)} />
              ) : (
                <p className="text-sm font-semibold">{practiceLine(null, 0, !!expected)}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {expected ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setHint(true);
                      say(`Try ${expected.san}.`);
                    }}
                    disabled={hint}
                  >
                    <Lightbulb className="size-4" aria-hidden /> Hint
                  </Button>
                ) : null}
                <Button size="sm" onClick={startPractice}>
                  <RotateCcw className="size-4" aria-hidden /> Restart
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <CopyLinkButton />
          </div>
          <ButtonLink size="sm" newTab href={`/analyze?fen=${encodeURIComponent(finalFen)}`}>
            <Search className="size-4" aria-hidden /> Analyze
          </ButtonLink>
          <ButtonLink size="sm" newTab href={`/play?fen=${encodeURIComponent(finalFen)}`}>
            <Swords className="size-4" aria-hidden /> Play from here
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
