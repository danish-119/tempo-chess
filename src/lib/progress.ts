import { z } from "zod";
import { hashString } from "@/lib/utils/hash";

/**
 * Progress: streaks, a puzzle-rating estimate, the daily puzzle and the
 * lessons and endgames finished. It is one document, kept
 * in the player's account (see storage/db.ts); export/import is a plain JSON
 * file you keep yourself.
 */
export const START_RATING = 1000;

const DaySchema = z.object({
  solved: z.number().int().min(0),
  attempted: z.number().int().min(0),
  other: z.number().int().min(0).default(0),
});


export const ProgressSchema = z.object({
  days: z.record(z.string(), DaySchema).default({}),
  rating: z.object({ value: z.number(), games: z.number().int().min(0) }).default({ value: START_RATING, games: 0 }),
  /** Daily puzzle results by date. */
  daily: z.record(z.string(), z.object({ puzzleId: z.string(), solved: z.boolean() })).default({}),
  rushBest: z.record(z.string(), z.number()).default({}),
  /** Completed lesson ids. */
  lessons: z.array(z.string().max(60)).max(500).default([]),
});
export type Progress = z.infer<typeof ProgressSchema>;

export function emptyProgress(): Progress {
  return ProgressSchema.parse({});
}

/** Local calendar date as YYYY-MM-DD (the streak follows the user's own midnight). */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

function bump(p: Progress, date: string, patch: Partial<{ solved: number; attempted: number; other: number }>): Progress {
  const day = p.days[date] ?? { solved: 0, attempted: 0, other: 0 };
  return {
    ...p,
    days: {
      ...p.days,
      [date]: {
        solved: day.solved + (patch.solved ?? 0),
        attempted: day.attempted + (patch.attempted ?? 0),
        other: day.other + (patch.other ?? 0),
      },
    },
  };
}

/** Elo-style update against the puzzle's rating (K shrinks as the estimate settles). */
export function recordPuzzle(p: Progress, date: string, puzzleRating: number, solvedFirstTry: boolean): Progress {
  const k = p.rating.games < 30 ? 40 : 24;
  const expected = 1 / (1 + 10 ** ((puzzleRating - p.rating.value) / 400));
  const value = Math.max(100, Math.round(p.rating.value + k * ((solvedFirstTry ? 1 : 0) - expected)));
  const next = bump(p, date, { attempted: 1, solved: solvedFirstTry ? 1 : 0 });
  return { ...next, rating: { value, games: p.rating.games + 1 } };
}

/** Counts a non-puzzle activity (blindfold, endgames, coordinates, lessons…) toward the streak. */
export function recordActivity(p: Progress, date: string): Progress {
  return bump(p, date, { other: 1 });
}

export function recordRush(p: Progress, date: string, mode: string, score: number): Progress {
  const best = Math.max(p.rushBest[mode] ?? 0, score);
  return { ...bump(p, date, { other: 1 }), rushBest: { ...p.rushBest, [mode]: best } };
}

export function recordLesson(p: Progress, date: string, id: string): Progress {
  const next = bump(p, date, { other: 1 });
  return p.lessons.includes(id) ? next : { ...next, lessons: [...p.lessons, id] };
}

export function hasActivity(p: Progress, date: string): boolean {
  const d = p.days[date];
  return !!d && d.solved + d.attempted + d.other > 0;
}

/**
 * Current streak: consecutive days with activity. Today does not break the
 * streak while it is still empty (you have until midnight), so it counts from
 * yesterday in that case.
 */
export function currentStreak(p: Progress, today: string): number {
  let day = hasActivity(p, today) ? today : addDays(today, -1);
  let n = 0;
  while (hasActivity(p, day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function longestStreak(p: Progress): number {
  const keys = Object.keys(p.days)
    .filter((k) => hasActivity(p, k))
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export function totals(p: Progress): { solved: number; attempted: number; activeDays: number } {
  let solved = 0;
  let attempted = 0;
  let activeDays = 0;
  for (const [k, d] of Object.entries(p.days)) {
    solved += d.solved;
    attempted += d.attempted;
    if (hasActivity(p, k)) activeDays++;
  }
  return { solved, attempted, activeDays };
}

/** Same puzzle for everyone on the same date, no server needed. */
export function dailyPuzzleIndex(date: string, poolSize: number): number {
  if (poolSize <= 0) return 0;
  return parseInt(hashString(`tempo-daily-${date}`), 36) % poolSize;
}

export function recordDaily(p: Progress, date: string, puzzleId: string, solved: boolean): Progress {
  const existing = p.daily[date];
  if (existing?.solved) return p; // already solved today
  return { ...p, daily: { ...p.daily, [date]: { puzzleId, solved } } };
}
