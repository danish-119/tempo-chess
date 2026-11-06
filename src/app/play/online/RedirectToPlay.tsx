"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/ui/primitives";

/** Forward /play/online#o=… to /play#o=… (the invite link is kept). */
export function RedirectToPlay() {
  useEffect(() => {
    window.location.replace(`/play${window.location.hash || "?online=1"}`);
  }, []);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-center">
      <Spinner label="Opening Play…" />
    </div>
  );
}
