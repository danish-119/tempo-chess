import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Suspense } from "react";
import { BoardPageSkeleton } from "@/components/ui/Skeleton";
import { EditorView } from "./EditorView";

export const metadata: Metadata = {
  title: "Board editor",
  description: "Set up any chess position, then analyze it with Stockfish or play it out against a bot.",
  alternates: { canonical: "/editor" },
};

export default function EditorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <PageHeader eyebrow="Tools" title="Board editor" phone={false} />
      <Suspense fallback={<BoardPageSkeleton label="Loading the board editor…" />}>
        <EditorView />
      </Suspense>
    </div>
  );
}
