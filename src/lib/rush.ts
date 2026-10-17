import type { Puzzle } from "@/lib/puzzles";

/**
 * Puzzle Rush: solve as many puzzles as possible; 3 mistakes end the run.
 * Difficulty ramps up: the n-th puzzle (0-based) targets START + n·STEP
 * rating, chosen at random within ±WINDOW among puzzles not yet seen.
 */
export const RUSH_MODES = [
  { id: "3min", label: "3 min", seconds: 180 },
  { id: "5min", label: "5 min", seconds: 300 },
  { id: "survival", label: "Survival", seconds: null },
] as const;

export type RushModeId = (typeof RUSH_MODES)[number]["id"];

export const RUSH_STRIKES = 3;
const START = 600;
const STEP = 55;
const MAX = 2900;
const WINDOW = 150;

export function rushTargetRating(index: number): number {
  return Math.min(MAX, START + index * STEP);
}

/** Pick the next rush puzzle near the target rating, widening the window if needed. */
export function pickRushPuzzle(all: Puzzle[], index: number, seen: Set<string>, random = Math.random): Puzzle | null {
  const target = rushTargetRating(index);
  for (let w = WINDOW; w <= 1200; w += 150) {
    const pool = all.filter((p) => !seen.has(p.id) && Math.abs(p.rating - target) <= w);
    if (pool.length > 0) return pool[Math.floor(random() * pool.length)];
  }
  const rest = all.filter((p) => !seen.has(p.id));
  return rest.length ? rest[Math.floor(random() * rest.length)] : null;
}

const bestKey = (mode: RushModeId) => `tempo:rush:best:${mode}`;

export function loadBest(mode: RushModeId): number {
  try {
    return Number(localStorage.getItem(bestKey(mode))) || 0;
  } catch {
    return 0;
  }
}

/** Save if it is a new best; returns true when it was a record. */
export function saveBest(mode: RushModeId, score: number): boolean {
  if (score <= loadBest(mode)) return false;
  try {
    localStorage.setItem(bestKey(mode), String(score));
  } catch {
    /* storage blocked */
  }
  return true;
}
