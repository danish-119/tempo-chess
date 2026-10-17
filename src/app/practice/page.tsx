import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticeTabs } from "./PracticeTabs";

export const metadata: Metadata = {
  title: "Practice",
  description: "Solve chess puzzles at your level or race the clock in Puzzle Rush — 10,000 hand-picked Lichess puzzles.",
  alternates: { canonical: "/practice" },
};

export default function PracticePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <Suspense>
        <PracticeTabs />
      </Suspense>
    </div>
  );
}
