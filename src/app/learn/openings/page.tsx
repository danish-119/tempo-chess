import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Suspense } from "react";
import { TileGridSkeleton } from "@/components/ui/Skeleton";
import { OpeningsView } from "./OpeningsView";

export const metadata: Metadata = {
  title: "Openings",
  description: "Learn the Italian, Ruy Lopez, Queen's Gambit, Sicilian, French, Caro-Kann, King's Indian and more — watch the main line, then practise it.",
  alternates: { canonical: "/learn/openings" },
};

export default function OpeningsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <PageHeader eyebrow="Learn" title="Openings" back={{ href: "/learn", label: "Back to Learn" }} />
      <Suspense fallback={<TileGridSkeleton label="Loading the openings…" />}>
        <OpeningsView />
      </Suspense>
    </div>
  );
}
