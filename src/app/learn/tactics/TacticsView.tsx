"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Puzzle as PuzzleIcon, Shuffle } from "lucide-react";
import { Alert, Button, ButtonLink, Card, IconButton, Spinner } from "@/components/ui/primitives";
import { TACTICS, TACTIC_GROUPS, type TacticLesson, examplesFor, tacticByTheme } from "@/lib/learn/tactics";
import { type Puzzle, loadPuzzles, preparePuzzle } from "@/lib/puzzles";
import { setQuery } from "@/lib/url";
import { LineViewer, buildUciLine } from "../LineViewer";

/** Themes with enough bundled puzzles to practise on their own. */
const PRACTICE_MIN = 15;

export function TacticsView() {
  const params = useSearchParams();
  const [tactic, setTactic] = useState<TacticLesson | null>(() => tacticByTheme(params.get("t")));

  const open = (t: TacticLesson | null) => {
    setTactic(t);
    setQuery({ t: t?.theme ?? null });
    window.scrollTo({ top: 0 });
  };

  if (!tactic) {
    return (
      <div className="space-y-6">
        {TACTIC_GROUPS.map((g) => (
          <section key={g} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{g}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TACTICS.filter((t) => t.group === g).map((t) => (
                <li key={t.theme}>
                  <button
                    type="button"
                    onClick={() => open(t)}
                    className="h-full w-full rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                  >
                    <span className="block font-semibold">{t.name}</span>
                    <span className="mt-1 line-clamp-2 block text-xs text-ink-3">{t.explain}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return <TacticLessonView key={tactic.theme} tactic={tactic} onBack={() => open(null)} />;
}

function TacticLessonView({ tactic, onBack }: { tactic: TacticLesson; onBack: () => void }) {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    loadPuzzles().then(setPuzzles, () => setFailed(true));
  }, []);

  const examples = useMemo(() => (puzzles ? examplesFor(puzzles, tactic.theme) : []), [puzzles, tactic.theme]);
  const count = useMemo(() => (puzzles ? puzzles.filter((p) => p.themes.includes(tactic.theme)).length : 0), [puzzles, tactic.theme]);
  const prepared = useMemo(() => (examples.length ? preparePuzzle(examples[index % examples.length]) : null), [examples, index]);
  const line = useMemo(() => (prepared ? buildUciLine(prepared.startFen, prepared.solution) : []), [prepared]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-14rem))]">
        {failed ? (
          <Alert tone="error">Examples could not be loaded. Please reload the page.</Alert>
        ) : !puzzles ? (
          <Spinner label="Loading examples…" />
        ) : prepared ? (
          <LineViewer
            key={prepared.puzzle.id}
            startFen={prepared.startFen}
            line={line}
            ply={ply}
            setPly={setPly}
            orientation={prepared.solver === "w" ? "white" : "black"}
            ariaLabel={`${tactic.name} example`}
          />
        ) : (
          <Alert tone="info">No example for this pattern yet.</Alert>
        )}
      </div>

      <div className="space-y-3">
        <Card className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <IconButton label="All tactics" onClick={onBack}>
              <ArrowLeft className="size-5" aria-hidden />
            </IconButton>
            <div>
              <p className="font-semibold">{tactic.name}</p>
              <p className="text-xs text-ink-3">{tactic.group}</p>
            </div>
          </div>
          <p className="text-sm">{tactic.explain}</p>
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">Look for: </span>
            {tactic.lookFor}
          </p>
        </Card>

        {prepared ? (
          <Card className="space-y-3 p-4" aria-live="polite">
            <p className="text-sm">
              <span className="font-semibold">Example {(index % examples.length) + 1}</span>
              <span className="text-ink-3">
                {" "}
                · {prepared.solver === "w" ? "White" : "Black"} to move · rating {prepared.puzzle.rating}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {examples.length > 1 ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setIndex((i) => i + 1);
                    setPly(0);
                  }}
                >
                  <Shuffle className="size-4" aria-hidden /> Another example
                </Button>
              ) : null}
              {count >= PRACTICE_MIN ? (
                <ButtonLink size="sm" variant="primary" href={`/practice?mode=puzzles&level=any&theme=${encodeURIComponent(tactic.theme)}`}>
                  <PuzzleIcon className="size-4" aria-hidden /> Practise {count} puzzles
                </ButtonLink>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
