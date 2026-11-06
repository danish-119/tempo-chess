"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Brain, Crown, EyeOff, Flame, Grid3x3, Puzzle } from "lucide-react";
import { IconButton } from "@/components/ui/primitives";
import { PracticeView } from "./PracticeView";
import { PuzzleRush } from "./PuzzleRush";
import { EndgameTrainer } from "./EndgameTrainer";
import { CoordinateTrainer } from "./CoordinateTrainer";
import { BlindfoldTrainer } from "./BlindfoldTrainer";
import { MistakeBank } from "./MistakeBank";
import { type ModeGroup, ModeChooser } from "./ModeChooser";

type Mode = "puzzles" | "rush" | "endgames" | "coordinates" | "blindfold" | "mistakes";

const MODES: { id: Mode; title: string; text: string; Icon: typeof Puzzle }[] = [
  { id: "puzzles", title: "Puzzles", text: "Solve at your own pace. Pick a level and theme.", Icon: Puzzle },
  { id: "rush", title: "Puzzle Rush", text: "Beat the clock. Puzzles get harder, three mistakes and you're out.", Icon: Flame },
  { id: "endgames", title: "Endgames", text: "Win the key endgames against perfect defence.", Icon: Crown },
  { id: "coordinates", title: "Coordinates", text: "Find the square. Learn the board in 30-second rounds.", Icon: Grid3x3 },
  { id: "blindfold", title: "Blindfold", text: "Play a bot with the board hidden. Type your moves, listen to the replies.", Icon: EyeOff },
  { id: "mistakes", title: "Mistake bank", text: "Re-practise your own mistakes from reviewed games, spaced over time.", Icon: Brain },
];

const GROUPS: ModeGroup<Mode>[] = [
  { title: "Tactics", blurb: "Spot the winning idea, at your own pace or against the clock.", ids: ["puzzles", "rush", "mistakes"] },
  { title: "Board skills", blurb: "Endgames, board vision and visualisation.", ids: ["endgames", "coordinates", "blindfold"] },
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
    url.search = ""; // drop the other mode's settings (level, theme, puzzle id, …)
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

  if (!mode) return <ModeChooser modes={MODES} groups={GROUPS} onChoose={choose} />;

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
      ) : mode === "blindfold" ? (
        <BlindfoldTrainer />
      ) : mode === "mistakes" ? (
        <MistakeBank />
      ) : (
        <PracticeView initialLevel={params.get("level")} initialTheme={params.get("theme")} initialId={params.get("id")} daily={params.get("daily") === "1"} />
      )}
    </>
  );
}
