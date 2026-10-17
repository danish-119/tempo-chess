import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/primitives";
import { PlayView } from "./PlayView";

export const metadata: Metadata = {
  title: "Play vs Stockfish",
  description: "Practise against Stockfish at adjustable strength, from the start or any position — then review the game.",
  alternates: { canonical: "/play" },
};

export default function PlayPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <h1 className="mb-3 font-serif text-2xl font-semibold tracking-tight">Play vs Stockfish</h1>
      <Suspense fallback={<Spinner label="Loading…" />}>
        <PlayView />
      </Suspense>
    </div>
  );
}
