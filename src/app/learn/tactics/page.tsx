import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";
import { TacticsView } from "./TacticsView";

export const metadata: Metadata = {
  title: "Tactics",
  description: "Learn forks, pins, skewers, discovered attacks and classic checkmate patterns with real puzzle examples.",
  alternates: { canonical: "/learn/tactics" },
};

export default function TacticsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/learn" aria-label="Back to Learn" className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Tactics</h1>
      </div>
      <Suspense fallback={<Spinner label="Loading…" />}>
        <TacticsView />
      </Suspense>
    </div>
  );
}
