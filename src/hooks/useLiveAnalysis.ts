"use client";

import { useEffect, useRef, useState } from "react";
import { terminalState } from "@/lib/chess/line";
import type { AnalysisSnapshot, StockfishEngine } from "@/lib/engine/engine";

/** Minimum depth before lines are shown, and minimum time between UI updates. */
const MIN_DISPLAY_DEPTH = 10;
const UPDATE_INTERVAL_MS = 500;

/**
 * A snapshot is "stable" when every line comes from the same completed
 * iteration (Stockfish reports MultiPV lines one by one, so mid-iteration
 * snapshots mix depths and reorder).
 */
export function isStableSnapshot(s: AnalysisSnapshot, minDepth = MIN_DISPLAY_DEPTH): boolean {
  if (s.lines.length === 0) return false;
  const d = s.lines[0].depth;
  return d >= minDepth && s.lines.every((l) => l.depth === d);
}

export interface LiveAnalysisOptions {
  depth: number;
  multiPv: number;
  /** Pause when the tab is hidden to save CPU / battery. */
  pauseWhenHidden: boolean;
  debounceMs?: number;
}

/**
 * Continuous analysis of the current position. Obsolete searches are stopped
 * when the position changes (debounced for rapid navigation), and results are
 * only accepted if they belong to the current position.
 */
export function useLiveAnalysis(engine: StockfishEngine | null, fen: string, enabled: boolean, opts: LiveAnalysisOptions) {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [hidden, setHidden] = useState(false);
  const frame = useRef<number | null>(null);
  const lastShown = useRef(0);
  const { depth, multiPv, pauseWhenHidden, debounceMs = 180 } = opts;

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const active = enabled && !!engine && !(pauseWhenHidden && hidden) && terminalState(fen) === null;

  useEffect(() => {
    if (!engine) return;
    if (!active) {
      if (engine.isSearching) engine.stop();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRunning(false);
      return;
    }
    let cancelled = false;
    setSnapshot((s) => (s && s.fen === fen ? s : null));
    const timer = setTimeout(() => {
      lastShown.current = 0;
      setRunning(true);
      engine
        .analyze({ fen, depth, multiPv }, (snap) => {
          if (cancelled) return;
          // Only show complete iterations, throttled, so lines don't flicker.
          if (!isStableSnapshot(snap, Math.min(MIN_DISPLAY_DEPTH, depth))) return;
          const now = performance.now();
          if (now - lastShown.current < UPDATE_INTERVAL_MS) return;
          lastShown.current = now;
          if (frame.current !== null) cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(() => setSnapshot(snap));
        })
        .then((snap) => {
          if (cancelled) return;
          setSnapshot(snap);
          setRunning(false);
        })
        .catch(() => {
          if (!cancelled) setRunning(false);
        });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [engine, fen, active, depth, multiPv, debounceMs]);

  // Stop searching when the component using the analysis unmounts.
  useEffect(() => () => engine?.stop(), [engine]);

  const current = snapshot && snapshot.fen === fen ? snapshot : null;
  return { snapshot: current, running: running && active, paused: enabled && pauseWhenHidden && hidden };
}
