import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
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
      <div className="mb-3 flex items-center gap-2">
        <Link href="/learn" aria-label="Back to Learn" className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Openings</h1>
      </div>
      <Suspense fallback={<Spinner label="Loading…" />}>
        <OpeningsView />
      </Suspense>
    </div>
  );
}
