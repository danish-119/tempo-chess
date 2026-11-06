import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { Suspense } from "react";
import { ImportTabs } from "./ImportTabs";

export const metadata: Metadata = {
  title: "Review a game",
  description: "Import your public Chess.com games by username, upload a PGN file, or paste PGN text.",
  alternates: { canonical: "/review" },
};

export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        eyebrow="Review"
        title="Review a game"
        subtitle="Import from Chess.com or Lichess, or paste a PGN. Stockfish grades every move in your browser."
        actions={<Link href="/analyze" className="pill pill-quiet !h-10">Empty analysis board</Link>}
      />
      <Suspense>
        <ImportTabs />
      </Suspense>
    </div>
  );
}
