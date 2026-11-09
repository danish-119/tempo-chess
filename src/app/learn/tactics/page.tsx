import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Suspense } from "react";
import { TileGridSkeleton } from "@/components/ui/Skeleton";
import { TacticsView } from "./TacticsView";

export const metadata: Metadata = {
  title: "Tactics",
  description: "Learn forks, pins, skewers, discovered attacks and classic checkmate patterns with real puzzle examples.",
  alternates: { canonical: "/learn/tactics" },
};

export default function TacticsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <PageHeader eyebrow="Learn" title="Tactics" back={{ href: "/learn", label: "Back to Learn" }} />
      <Suspense fallback={<TileGridSkeleton label="Loading the tactics…" />}>
        <TacticsView />
      </Suspense>
    </div>
  );
}
