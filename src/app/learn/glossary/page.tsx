import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlossaryView } from "./GlossaryView";

export const metadata: Metadata = {
  title: "Glossary",
  description: "Plain-language meanings of chess terms: rules, openings, strategy, tactics, endgames, notation, time controls and engine analysis.",
  alternates: { canonical: "/learn/glossary" },
};

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <PageHeader eyebrow="Learn" title="Glossary" back={{ href: "/learn", label: "Back to Learn" }} />
      <GlossaryView />
    </div>
  );
}
