import type { Color } from "@/lib/chess/types";

export interface TimeControlOption {
  id: string;
  label: string;
  /** Speed category, used for the icon. */
  kind: "none" | "bullet" | "blitz" | "rapid" | "classical";
  /** null = untimed. */
  baseMs: number | null;
  incrementMs: number;
}

export const TIME_CONTROLS: TimeControlOption[] = [
  { id: "none", kind: "none", label: "No clock", baseMs: null, incrementMs: 0 },
  { id: "1+0", kind: "bullet", label: "1 min", baseMs: 60_000, incrementMs: 0 },
  { id: "3+2", kind: "blitz", label: "3 | 2", baseMs: 180_000, incrementMs: 2_000 },
  { id: "5+0", kind: "blitz", label: "5 min", baseMs: 300_000, incrementMs: 0 },
  { id: "10+0", kind: "rapid", label: "10 min", baseMs: 600_000, incrementMs: 0 },
  { id: "15+10", kind: "rapid", label: "15 | 10", baseMs: 900_000, incrementMs: 10_000 },
  { id: "30+0", kind: "classical", label: "30 min", baseMs: 1_800_000, incrementMs: 0 },
];

export interface ClockState {
  remaining: Record<Color, number>;
  /** Side whose clock is running, or null when stopped. */
  running: Color | null;
  /** performance.now() when `running` started its current stretch. */
  since: number;
}

export function initClock(baseMs: number): ClockState {
  return { remaining: { w: baseMs, b: baseMs }, running: null, since: 0 };
}

/** Time left for `side` at `now`, accounting for a running clock. */
export function timeLeft(c: ClockState, side: Color, now: number): number {
  const base = c.remaining[side];
  return c.running === side ? Math.max(0, base - (now - c.since)) : base;
}

/** Stop the running side's clock (adding increment if it just moved) and start `next`. */
export function switchClock(c: ClockState, next: Color | null, now: number, incrementMs: number): ClockState {
  const remaining = { ...c.remaining };
  if (c.running) remaining[c.running] = Math.max(0, remaining[c.running] - (now - c.since)) + incrementMs;
  return { remaining, running: next, since: now };
}

export function formatMs(ms: number): string {
  const total = Math.max(0, ms);
  const s = Math.floor(total / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (total < 20_000) return `${m}:${String(sec).padStart(2, "0")}.${Math.floor((total % 1000) / 100)}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
