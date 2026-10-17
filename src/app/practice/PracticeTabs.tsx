"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Crown, Flame, Grid3x3, Puzzle } from "lucide-react";
import { IconButton } from "@/components/ui/primitives";
import { PracticeView } from "./PracticeView";
import { PuzzleRush } from "./PuzzleRush";
import { EndgameTrainer } from "./EndgameTrainer";
import { CoordinateTrainer } from "./CoordinateTrainer";

type Mode = "puzzles" | "rush" | "endgames" | "coordinates";

const MODES: { id: Mode; title: string; text: string; Icon: typeof Puzzle }[] = [
  { id: "puzzles", title: "Puzzles", text: "Solve at your own pace. Pick a level and theme.", Icon: Puzzle },
  { id: "rush", title: "Puzzle Rush", text: "Beat the clock. Puzzles get harder, three mistakes and you're out.", Icon: Flame },
  { id: "endgames", title: "Endgames", text: "Win the key endgames against perfect defence.", Icon: Crown },
  { id: "coordinates", title: "Coordinates", text: "Find the square. Learn the board in 30-second rounds.", Icon: Grid3x3 },
];

const readMode = (v: string | null): Mode | null => (MODES.some((m) => m.id === v) ? (v as Mode) : null);

/** Practice starts on a choice of mode; Back returns to it. */
export function PracticeTabs() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode | null>(readMode(params.get("mode")));
  /** True when the chooser is the previous history entry (so Back returns to it). */
  const pushed = useRef(false);

  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
      setMode(readMode(new URLSearchParams(window.location.search).get("mode")));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const choose = (m: Mode) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("mode", m);
    window.history.pushState(window.history.state, "", url);
    pushed.current = true;
    setMode(m);
  };

  const back = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
    else {
      window.history.replaceState(window.history.state, "", window.location.pathname);
      setMode(null);
    }
  };

  if (!mode) {
    return (
      <>
        <h1 className="mb-4 font-serif text-2xl font-semibold tracking-tight">Practice</h1>
        <ul className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          {MODES.map(({ id, title, text, Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => choose(id)}
                className="flex h-full w-full flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center shadow-sm transition-colors hover:border-accent hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon className="size-12 text-accent" aria-hidden />
                <span className="font-serif text-xl font-semibold">{title}</span>
                <span className="text-sm text-ink-2">{text}</span>
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <IconButton label="Back to practice modes" onClick={back}>
          <ArrowLeft className="size-5" aria-hidden />
        </IconButton>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">{MODES.find((m) => m.id === mode)?.title}</h1>
      </div>
      {mode === "rush" ? (
        <PuzzleRush initialMode={params.get("rush")} />
      ) : mode === "endgames" ? (
        <EndgameTrainer initialLesson={params.get("lesson")} initialFen={params.get("fen")} />
      ) : mode === "coordinates" ? (
        <CoordinateTrainer />
      ) : (
        <PracticeView initialLevel={params.get("level")} initialTheme={params.get("theme")} />
      )}
    </>
  );
}
