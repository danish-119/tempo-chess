import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { Suspense } from "react";
import { LayoutGrid } from "lucide-react";
import { ImportTabs } from "./ImportTabs";
import { RecentGames } from "./RecentGames";

export const metadata: Metadata = {
  title: "Review a game",
  description: "Import your Chess.com or Lichess games by username, upload a PGN file, or paste PGN text, and review them move by move.",
  alternates: { canonical: "/review" },
};

export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        eyebrow="Review"
        title="Review a game"
        actions={
          <Link href="/analyze" className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-surface-2">
            <LayoutGrid className="size-4" aria-hidden /> Analysis board
          </Link>
        }
      />
      <div className="space-y-8">
        <Suspense>
          <ImportTabs />
        </Suspense>
        <RecentGames />
      </div>
    </div>
  );
}
