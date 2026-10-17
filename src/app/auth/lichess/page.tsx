import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/primitives";
import { LichessCallback } from "./LichessCallback";

export const metadata: Metadata = {
  title: "Connecting Lichess",
  robots: { index: false, follow: false },
};

export default function LichessCallbackPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Suspense fallback={<Spinner label="Connecting…" />}>
        <LichessCallback />
      </Suspense>
    </div>
  );
}
