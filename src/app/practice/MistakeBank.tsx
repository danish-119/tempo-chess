"use client";

import { Eye, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import { Board } from "@/components/board/Board";
import { Alert, Button, Card, SectionTitle } from "@/components/ui/primitives";
import { useProgress, record } from "@/hooks/useProgress";
import { useSound } from "@/hooks/useSound";
import { applyUci, parseUci } from "@/lib/chess/line";
import { Chess } from "chess.js";
import { type Mistake, dateKey, dueMistakes, gradeMistake, recordActivity, retireMastered } from "@/lib/progress";

type Outcome = "asking" | "right" | "wrong" | "revealed";

/** Re-practise your own mistakes: find the move the engine preferred, with spaced repetition. */
export function MistakeBank() {
  const sound = useSound();
  const { progress, ready } = useProgress();
  const [today, setToday] = useState("");
  const [queue, setQueue] = useState<Mistake[] | null>(null);
  const [index, setIndex] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>("asking");
  const [fixed, setFixed] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(dateKey());
  }, []);

  // Freeze the queue when the session starts so grading does not reshuffle it.
  useEffect(() => {
    if (ready && today && queue === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueue(dueMistakes(progress, today));
    }
  }, [ready, today, queue, progress]);

  // The session keeps its own copy, so a mistake retired mid-session does not vanish from view.
  const current = queue?.[index] ?? null;

  const grade = (correct: boolean) => {
    if (!current) return;
    record((p) => retireMastered(recordActivity(gradeMistake(p, current.id, correct, dateKey()), dateKey())));
    if (correct) setFixed((n) => n + 1);
  };

  const onMove = (uci: string): boolean => {
    if (!current || outcome !== "asking") return false;
    const ok = uci === current.bestUci;
    setOutcome(ok ? "right" : "wrong");
    sound.play(ok ? "correct" : "incorrect");
    grade(ok);
    return ok;
  };

  const reveal = () => {
    if (!current || outcome !== "asking") return;
    setOutcome("revealed");
    grade(false);
  };

  const next = () => {
    setIndex((i) => i + 1);
    setOutcome("asking");
  };

  if (!ready || queue === null) return <p className="py-10 text-center text-sm text-ink-2">Loading your mistakes…</p>;

  if (progress.mistakes.length === 0) {
    return (
      <Alert tone="info" title="Your mistake bank is empty">
        Open a game in Review and use &ldquo;Practise these mistakes later&rdquo;. Tempo will bring them back here at the right time.
      </Alert>
    );
  }

  if (!current) {
    return (
      <Card className="mx-auto max-w-md space-y-2 p-6 text-center">
        <p className="font-serif text-2xl font-semibold">{queue.length === 0 ? "Nothing due today" : "Session complete"}</p>
        <p className="text-sm text-ink-2">
          {queue.length === 0
            ? `${progress.mistakes.length} mistakes are saved; none are due yet. Come back tomorrow.`
            : `You found the better move in ${fixed} of ${queue.length}. Missed ones come back tomorrow.`}
        </p>
      </Card>
    );
  }

  const board = new Chess(current.fen);
  const orientation = board.turn() === "w" ? "white" : "black";
  const answered = outcome !== "asking";
  const afterBest = (() => {
    const c = new Chess(current.fen);
    return applyUci(c, current.bestUci) ? c.fen() : current.fen;
  })();
  const best = parseUci(current.bestUci);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-12rem))]">
        <Board
          fen={answered ? afterBest : current.fen}
          orientation={orientation}
          lastMove={answered && best ? { from: best.from, to: best.to } : null}
          interactive={!answered}
          movableColor={board.turn()}
          onMove={onMove}
          id="tempo-mistakes"
          ariaLabel="Mistake bank board"
        />
      </div>
      <Card className="h-fit space-y-4 p-4">
        <div>
          <SectionTitle>
            Mistake {index + 1} of {queue.length}
          </SectionTitle>
          <p className="mt-1 text-sm text-ink-2">
            From <span className="font-medium text-ink">{current.gameLabel || "an earlier game"}</span>. You played{" "}
            <span className="font-mono">{current.playedSan}</span>. Find the better move.
          </p>
        </div>
        <div aria-live="polite">
          {outcome === "right" ? <Alert tone="success" title="That's the move">{current.bestSan} is what the engine preferred. It comes back later to be sure.</Alert> : null}
          {outcome === "wrong" ? (
            <Alert tone="warning" title="Not quite">
              The engine preferred <span className="font-mono font-semibold">{current.bestSan}</span>. You will see this one again tomorrow.
            </Alert>
          ) : null}
          {outcome === "revealed" ? (
            <Alert tone="info" title="The better move">
              <span className="font-mono font-semibold">{current.bestSan}</span>. You will see this one again tomorrow.
            </Alert>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!answered ? (
            <Button onClick={reveal}>
              <Eye className="mr-1.5 size-4" aria-hidden /> Show answer
            </Button>
          ) : (
            <Button variant="primary" onClick={next}>
              <SkipForward className="mr-1.5 size-4" aria-hidden /> {index + 1 >= queue.length ? "Finish" : "Next"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
