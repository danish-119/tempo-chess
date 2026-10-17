import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/primitives";
import { EditorView } from "./EditorView";

export const metadata: Metadata = {
  title: "Board editor",
  description: "Set up any chess position, then analyze it with Stockfish or play it out against a bot.",
  alternates: { canonical: "/editor" },
};

export default function EditorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <h1 className="mb-3 font-serif text-2xl font-semibold tracking-tight">Board editor</h1>
      <Suspense fallback={<Spinner label="Loading…" />}>
        <EditorView />
      </Suspense>
    </div>
  );
}
