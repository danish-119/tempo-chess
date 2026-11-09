import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardPageSkeleton } from "@/components/ui/Skeleton";
import { PlayView } from "./PlayView";

export const metadata: Metadata = {
  title: "Play",
  description: "Play 10 bots from beginner to full-strength Stockfish, a coach who helps you improve, or a friend on the same device — then review the game.",
  alternates: { canonical: "/play" },
};

export default function PlayPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <h1 className="mb-3 font-serif text-2xl font-semibold tracking-tight max-sm:sr-only">Play</h1>
      <Suspense fallback={<BoardPageSkeleton label="Loading Play…" />}>
        <PlayView />
      </Suspense>
    </div>
  );
}
