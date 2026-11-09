import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { LearnTiles } from "./LearnTiles";

export const metadata: Metadata = {
  title: "Learn",
  description: "Learn the main chess openings move by move, the common tactics and checkmate patterns, and the words chess players use.",
  alternates: { canonical: "/learn" },
};

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-3 sm:py-10">
      <PageHeader eyebrow="Chess" size="lg" title="Learn" phone={false} />
      <LearnTiles />
    </div>
  );
}
