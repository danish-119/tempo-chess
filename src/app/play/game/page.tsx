import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardPageSkeleton } from "@/components/ui/Skeleton";
import { GameView } from "./GameView";

export const metadata: Metadata = {
  title: "Online game",
  description: "Play chess with a friend or watch a live game on Tempo.",
  robots: { index: false },
};

/** One address per online game (/play/game?code=K7F2QD): join, play or watch. */
export default function GamePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
      <Suspense fallback={<BoardPageSkeleton label="Opening the game…" />}>
        <GameView />
      </Suspense>
    </div>
  );
}
