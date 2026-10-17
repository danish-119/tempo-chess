import type { Metadata } from "next";
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Review a game</h1>
        <Link href="/analyze" className="text-sm text-ink-2 underline">Open an empty analysis board</Link>
      </div>
      <Suspense>
        <ImportTabs />
      </Suspense>
    </div>
  );
}
