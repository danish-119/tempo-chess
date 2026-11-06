import { z } from "zod";
import { hashString } from "@/lib/utils/hash";

/**
 * Local progress: streaks, a puzzle-rating estimate, the daily puzzle and a
 * "mistake bank" of your own errors to re-practise. Everything lives in this
 * one document in IndexedDB (see storage/db.ts) and never leaves the device;
 * export/import is a plain JSON file you keep yourself.
 */
export const START_RATING = 1000;
export const MAX_MISTAKES = 300;
/** Leitner boxes: days until a mistake comes back after N correct answers in a row. */
export const REVIEW_INTERVALS = [0, 1, 3, 7, 16, 35];

const DaySchema = z.object({
  solved: z.number().int().min(0),
  attempted: z.number().int().min(0),
  other: z.number().int().min(0).default(0),
});

const MistakeSchema = z.object({
  id: z.string().max(120),
  /** Position before the mistaken move. */
  fen: z.string().max(100),
  /** What was played, and what the engine preferred (UCI + SAN). */
  playedUci: z.string().max(8),
  playedSan: z.string().max(16),
  bestUci: z.string().max(8),
  bestSan: z.string().max(16),
  classification: z.string().max(20),
  gameLabel: z.string().max(120).default(""),
  addedOn: z.string(),
  box: z.number().int().min(0).max(5),
  /** Local date (YYYY-MM-DD) when it is next due. */
  due: z.string(),
});
export type Mistake = z.infer<typeof MistakeSchema>;

export const ProgressSchema = z.object({
  days: z.record(z.string(), DaySchema).default({}),
  rating: z.object({ value: z.number(), games: z.number().int().min(0) }).default({ value: START_RATING, games: 0 }),
  /** Daily puzzle results by date. */
  daily: z.record(z.string(), z.object({ puzzleId: z.string(), solved: z.boolean() })).default({}),
  rushBest: z.record(z.string(), z.number()).default({}),
  mistakes: z.array(MistakeSchema).max(MAX_MISTAKES).default([]),
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

// --- Mistake bank (spaced repetition) ---------------------------------------

export function addMistakes(p: Progress, items: Omit<Mistake, "box" | "due" | "addedOn">[], today: string): Progress {
  const known = new Set(p.mistakes.map((m) => m.id));
  const fresh = items.filter((m) => !known.has(m.id)).map((m): Mistake => ({ ...m, addedOn: today, box: 0, due: today }));
  if (fresh.length === 0) return p;
  return { ...p, mistakes: [...p.mistakes, ...fresh].slice(-MAX_MISTAKES) };
}

export function dueMistakes(p: Progress, today: string): Mistake[] {
  return p.mistakes.filter((m) => m.due <= today).sort((a, b) => a.due.localeCompare(b.due) || a.box - b.box);
}

/** Correct answers move a mistake to a later box; a miss sends it back to box 0 (due tomorrow). */
export function gradeMistake(p: Progress, id: string, correct: boolean, today: string): Progress {
  return {
    ...p,
    mistakes: p.mistakes.map((m) => {
      if (m.id !== id) return m;
      const box = correct ? Math.min(REVIEW_INTERVALS.length - 1, m.box + 1) : 0;
      return { ...m, box, due: addDays(today, correct ? REVIEW_INTERVALS[box] : 1) };
    }),
  };
}

/** A mistake mastered in the last box is retired from the bank. */
export function retireMastered(p: Progress): Progress {
  return { ...p, mistakes: p.mistakes.filter((m) => m.box < REVIEW_INTERVALS.length - 1) };
}

// --- Export / import -----------------------------------------------------------

export function exportProgress(p: Progress): string {
  return JSON.stringify({ app: "tempo", kind: "progress", version: 1, exportedAt: new Date().toISOString(), progress: p }, null, 2);
}

export type ImportResult = { ok: true; progress: Progress } | { ok: false; error: string };

export function parseProgress(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  const wrapper = z.object({ app: z.literal("tempo"), kind: z.literal("progress"), progress: z.unknown() }).safeParse(raw);
  if (!wrapper.success) return { ok: false, error: "This is not a Tempo progress file." };
  const parsed = ProgressSchema.safeParse(wrapper.data.progress);
  if (!parsed.success) return { ok: false, error: "The progress data in this file is damaged." };
  return { ok: true, progress: parsed.data };
}

/** Merge two progress documents (import adds to what you have instead of replacing it). */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const days: Progress["days"] = { ...a.days };
  for (const [k, d] of Object.entries(b.days)) {
    const x = days[k];
    days[k] = x ? { solved: Math.max(x.solved, d.solved), attempted: Math.max(x.attempted, d.attempted), other: Math.max(x.other, d.other) } : d;
  }
  const mistakes = new Map(a.mistakes.map((m) => [m.id, m]));
  for (const m of b.mistakes) if (!mistakes.has(m.id)) mistakes.set(m.id, m);
  const rushBest = { ...a.rushBest };
  for (const [k, v] of Object.entries(b.rushBest)) rushBest[k] = Math.max(rushBest[k] ?? 0, v);
  return {
    days,
    rating: b.rating.games > a.rating.games ? b.rating : a.rating,
    daily: { ...b.daily, ...a.daily },
    rushBest,
    mistakes: [...mistakes.values()].slice(-MAX_MISTAKES),
    lessons: [...new Set([...a.lessons, ...b.lessons])],
  };
}
