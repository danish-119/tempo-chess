import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GlossaryView } from "./GlossaryView";

export const metadata: Metadata = {
  title: "Glossary",
  description: "Plain-language meanings of chess terms: rules, openings, strategy, tactics, endgames, notation, time controls and engine analysis.",
  alternates: { canonical: "/learn/glossary" },
};

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/learn" aria-label="Back to Learn" className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Glossary</h1>
      </div>
      <GlossaryView />
    </div>
  );
}
