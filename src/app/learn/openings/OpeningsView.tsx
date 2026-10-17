"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lightbulb, RotateCcw, Search, Swords } from "lucide-react";
import { ModeToggle } from "@/components/board/ModeToggle";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { Alert, Button, ButtonLink, Card, IconButton } from "@/components/ui/primitives";
import { useSound } from "@/hooks/useSound";
import { START_FEN } from "@/lib/chess/types";
import { OPENINGS, OPENING_GROUPS, type OpeningLesson, openingById } from "@/lib/learn/openings";
import { setQuery } from "@/lib/url";
import { LineViewer, buildLine } from "../LineViewer";

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
      <div className="space-y-6">
        {OPENING_GROUPS.map((g) => (
          <section key={g} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{g}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {OPENINGS.filter((o) => o.group === g).map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => open(o)}
                    className="h-full w-full rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{o.name}</span>
                      <span className="font-mono text-xs text-ink-3">{o.eco}</span>
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
  const line = useMemo(() => buildLine(START_FEN, opening.moves.split(" ")), [opening.moves]);
  const [ply, setPly] = useState(0);
  const [mode, setMode] = useState<"watch" | "practice">("watch");
  const [feedback, setFeedback] = useState<"wrong" | "done" | null>(null);
  const [hint, setHint] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalFen = line[line.length - 1].fenAfter;
  const yourTurn = (n: number) => (n % 2 === 0 ? "w" : "b") === opening.side;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /** In practice mode, the opponent's moves play themselves. */
  const autoReply = (n: number) => {
    if (n < line.length && !yourTurn(n)) {
      timer.current = setTimeout(() => {
        sound.playSan(line[n].san);
        setPly(n + 1);
        if (n + 1 >= line.length) setFeedback("done");
      }, 500);
    } else if (n >= line.length) setFeedback("done");
  };

  const startPractice = () => {
    if (timer.current) clearTimeout(timer.current);
    setMode("practice");
    setPly(0);
    setFeedback(null);
    setHint(false);
    setMistakes(0);
    autoReply(0);
  };

  const onMove = (uci: string): boolean => {
    if (mode !== "practice" || ply >= line.length || !yourTurn(ply)) return false;
    const expected = line[ply];
    if (uci !== expected.uci) {
      setFeedback("wrong");
      setMistakes((m) => m + 1);
      sound.play("incorrect");
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
        />
      </div>

      <div className="space-y-3">
        <Card className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <IconButton label="All openings" onClick={onBack}>
              <ArrowLeft className="size-5" aria-hidden />
            </IconButton>
            <div>
              <p className="font-semibold">{opening.name}</p>
              <p className="text-xs text-ink-3">
                {opening.eco} · for {opening.side === "w" ? "White" : "Black"}
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-2">{opening.summary}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {opening.ideas.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3 p-4" aria-live="polite">
          <ModeToggle
            value={mode}
            onChange={(m) => {
              if (m === "practice") startPractice();
              else {
                setMode("watch");
                setFeedback(null);
                setHint(false);
              }
            }}
          />

          {mode === "practice" ? (
            <>
              {feedback === "done" ? (
                <Alert tone="success" title={mistakes === 0 ? "Perfect — you know this line!" : `Line complete (${mistakes} mistake${mistakes === 1 ? "" : "s"})`} />
              ) : feedback === "wrong" ? (
                <Alert tone="warning" title="Not the main line — try again" />
              ) : (
                <p className="text-sm font-semibold">{expected ? "Your move: play the main line" : "Opponent is moving…"}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {expected ? (
                  <Button size="sm" onClick={() => setHint(true)} disabled={hint}>
                    <Lightbulb className="size-4" aria-hidden /> Hint
                  </Button>
                ) : null}
                <Button size="sm" onClick={startPractice}>
                  <RotateCcw className="size-4" aria-hidden /> Restart
                </Button>
              </div>
            </>
          ) : null}
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
