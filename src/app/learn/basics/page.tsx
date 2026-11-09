import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { BasicsView } from "./BasicsView";

export const metadata: Metadata = {
  title: "Learn the basics",
  description: "Never played chess? Learn how every piece moves, the special rules, check and checkmate, and how to start a game, one small step at a time with a coach who talks you through it.",
  alternates: { canonical: "/learn/basics" },
};

export default function BasicsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-3 sm:py-6">
      <PageHeader eyebrow="Learn" title="Basics" back={{ href: "/learn", label: "Back to Learn" }} />
      <BasicsView />
    </div>
  );
}
