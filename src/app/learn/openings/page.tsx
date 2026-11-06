import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/primitives";
import { OpeningsView } from "./OpeningsView";

export const metadata: Metadata = {
  title: "Openings",
  description: "Learn the Italian, Ruy Lopez, Queen's Gambit, Sicilian, French, Caro-Kann, King's Indian and more — watch the main line, then practise it.",
  alternates: { canonical: "/learn/openings" },
};

export default function OpeningsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <PageHeader eyebrow="Learn" title="Openings" subtitle="The main lines and the ideas behind them. Watch, then play them yourself." back={{ href: "/learn", label: "Back to Learn" }} />
      <Suspense fallback={<Spinner label="Loading…" />}>
        <OpeningsView />
      </Suspense>
    </div>
  );
}
