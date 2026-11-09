"use client";

import { useEffect } from "react";
import { BoardPageSkeleton } from "@/components/ui/Skeleton";

/** Old address for online play: forward to Play, online. */
export function RedirectToPlay() {
  useEffect(() => {
    window.location.replace("/play?mode=online");
  }, []);
  return (
    <BoardPageSkeleton label="Opening Play…" className="mx-auto max-w-6xl px-4 py-4" />
  );
}
