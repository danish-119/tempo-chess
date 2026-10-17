"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportedGame } from "@/lib/chess/types";
import type { StockfishEngine } from "@/lib/engine/engine";
import { loadOpeningTable } from "@/lib/openings";
import { REVIEW_PRESETS, ReviewCancelledError, type ReviewProgress, runReview, upgradeReview } from "@/lib/review/review";
import { type GameReview, type PositionEval, REVIEW_VERSION, type ReviewSettings } from "@/lib/review/types";
import { getReview, saveGame, saveReview } from "@/lib/storage/db";

export type ReviewState =
  | { status: "idle" }
  | { status: "loading-saved" }
  | { status: "running"; progress: ReviewProgress; settings: ReviewSettings }
  | { status: "done"; review: GameReview; savedLocally: boolean }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export function useReview(game: ImportedGame | null) {
  // Start in "loading-saved" when there is a game: until the stored review has been
  // looked up, nothing may treat the game as unreviewed (and auto-start a new review).
  const [state, setState] = useState<ReviewState>(() => (game ? { status: "loading-saved" } : { status: "idle" }));
  const abortRef = useRef<AbortController | null>(null);
  // Position cache survives cancel/restart so resumed reviews skip finished work.
  const cacheRef = useRef<{ key: string; map: Map<string, PositionEval> } | null>(null);

  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading-saved" });
    getReview(game.id)
      .then(async (r) => {
        if (!r) return r;
        if (r.version === REVIEW_VERSION) return r;
        // Saved under older rules: re-classify from the stored engine output.
        const upgraded = upgradeReview(game, r, await loadOpeningTable().catch(() => null));
        await saveReview(upgraded).catch(() => undefined);
        return upgraded;
      })
      .then((r) => {
        if (!cancelled) setState(r ? { status: "done", review: r, savedLocally: true } : { status: "idle" });
      })
      .catch(() => !cancelled && setState({ status: "idle" }));
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [game]);

  const start = useCallback(
    async (engine: StockfishEngine, preset: ReviewSettings["preset"]) => {
      if (!game) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const settings = REVIEW_PRESETS[preset];
      const cacheKey = `${game.id}:${preset}`;
      if (cacheRef.current?.key !== cacheKey) cacheRef.current = { key: cacheKey, map: new Map() };
      const total = game.moves.length + 1;
      setState({ status: "running", progress: { done: 0, total, position: 0 }, settings });
      try {
        const openingTable = await loadOpeningTable().catch(() => null);
        engine.stop();
        const review = await runReview(game, engine, settings, {
          engineName: engine.info.name,
          openingTable,
          signal: controller.signal,
          cache: cacheRef.current.map,
          onProgress: (progress) => setState({ status: "running", progress, settings }),
        });
        let savedLocally = true;
        try {
          await saveGame(game);
          await saveReview(review);
        } catch {
          savedLocally = false;
        }
        setState({ status: "done", review, savedLocally });
      } catch (err) {
        if (err instanceof ReviewCancelledError || controller.signal.aborted) {
          setState({ status: "cancelled" });
        } else {
          setState({ status: "error", message: err instanceof Error ? err.message : "The review failed." });
        }
      }
    },
    [game],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { state, start, cancel };
}
