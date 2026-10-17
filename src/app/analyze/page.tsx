import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalysisWorkspace } from "@/components/analysis/AnalysisWorkspace";
import { Spinner } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Analyze",
  description: "Analyse chess positions and review games with Stockfish in your browser.",
  alternates: { canonical: "/analyze" },
  // Game-specific URLs (?game=…) only work in the browser that saved them.
  robots: { index: true, follow: true },
};

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-10">
          <Spinner label="Loading analysis board…" />
        </div>
      }
    >
      <AnalysisWorkspace />
    </Suspense>
  );
}
