"use client";

import { useSyncExternalStore } from "react";
import { type LichessAuth, getLichessAuth, subscribeLichessAuth } from "@/lib/lichess/auth";

/** The connected Lichess account (null when not connected; always null during SSR). */
export function useLichessAuth(): LichessAuth | null {
  return useSyncExternalStore(subscribeLichessAuth, getLichessAuth, () => null);
}
