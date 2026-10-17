import type { PlyRecord } from "@/lib/chess/types";

export interface TimeControlInfo {
  baseSeconds: number;
  incrementSeconds: number;
}

export function parseTimeControl(tc: string | undefined): TimeControlInfo | null {
  if (!tc) return null;
  const m = /^(\d+)(?:\+(\d+(?:\.\d+)?))?$/.exec(tc.trim());
  if (!m) return null;
  return { baseSeconds: Number(m[1]), incrementSeconds: Number(m[2] ?? 0) };
}

export interface MoveTiming {
  ply: number;
  clockSeconds?: number;
  timeSpentSeconds?: number;
  underTimePressure: boolean;
}

/**
 * Derive time spent per move from [%clk] annotations.
 * spent = previous clock of the same player − current clock + increment.
 * Time pressure = less than 10% of base time or under 30 seconds left
 * (whichever is lower; never flagged for daily games without a base).
 */
export function computeTimings(moves: PlyRecord[], tc: TimeControlInfo | null): MoveTiming[] {
  const last: { w?: number; b?: number } = {};
  const increment = tc?.incrementSeconds ?? 0;
  const pressureLine = tc ? Math.min(30, tc.baseSeconds * 0.1) : 0;
  return moves.map((mv) => {
    const clock = mv.clockSeconds;
    let spent: number | undefined;
    const prev = last[mv.color] ?? tc?.baseSeconds;
    if (clock !== undefined && prev !== undefined) {
      spent = Math.max(0, Math.round((prev - clock + increment) * 10) / 10);
    }
    if (clock !== undefined) last[mv.color] = clock;
    // Pressure is judged by the clock BEFORE the move was played.
    const before = prev;
    const underTimePressure = tc !== null && before !== undefined && before < pressureLine;
    return { ply: mv.ply, clockSeconds: clock, timeSpentSeconds: spent, underTimePressure };
  });
}

export function formatClock(seconds: number | undefined): string {
  if (seconds === undefined) return "–";
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const tenths = s < 20 ? `.${Math.floor((s * 10) % 10)}` : "";
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}${tenths}`;
}
