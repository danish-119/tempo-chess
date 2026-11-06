import type { Color } from "@/lib/chess/types";
import { type ClockState, type TimeControlOption, initClock, switchClock, timeLeft } from "@/lib/clock";

/**
 * Clocks for peer-to-peer games. Each browser runs its own clock; every move
 * carries the mover's remaining time so both screens stay in step, and a
 * player whose time runs out declares the loss themselves. Because the
 * opponent is untrusted, the time they claim can never exceed what they had
 * at the start of their turn plus the increment.
 */
export const FLAG_GRACE_MS = 4000;

const opposite = (c: Color): Color => (c === "w" ? "b" : "w");

/** White's clock starts running as soon as the game begins. */
export function startOnlineClock(tc: TimeControlOption, now: number): ClockState | null {
  if (tc.baseMs === null) return null;
  return { ...initClock(tc.baseMs), running: "w", since: now };
}

/** Clock after I move, plus the remaining time to tell the opponent. */
export function afterLocalMove(clock: ClockState, me: Color, tc: TimeControlOption, now: number): { clock: ClockState; ms: number } {
  const next = switchClock(clock, opposite(me), now, tc.incrementMs);
  return { clock: next, ms: Math.round(next.remaining[me]) };
}

/** Clock after the opponent's move. `claimedMs` is what they say they have left (validated here). */
export function afterRemoteMove(clock: ClockState, me: Color, tc: TimeControlOption, claimedMs: number | undefined, now: number): ClockState {
  const remote = opposite(me);
  const startOfTheirTurn = clock.remaining[remote]; // not updated while their clock runs
  const estimate = timeLeft(clock, remote, now);
  const claimed = claimedMs === undefined || !Number.isFinite(claimedMs) ? estimate : claimedMs;
  const allowed = Math.max(0, Math.min(claimed, startOfTheirTurn + tc.incrementMs));
  const switched = switchClock(clock, me, now, 0);
  return { ...switched, remaining: { ...switched.remaining, [remote]: allowed } };
}

export type TimeoutVerdict = { loser: Color; mine: boolean } | null;

/**
 * Has the running side run out of time? If it is me, I declare the loss now;
 * if it is the opponent, I wait a grace period (they normally declare it
 * themselves) before claiming the win.
 */
export function timeoutVerdict(clock: ClockState | null, me: Color, now: number): TimeoutVerdict {
  if (!clock?.running) return null;
  const left = timeLeft(clock, clock.running, now);
  if (left > 0) return null;
  if (clock.running === me) return { loser: me, mine: true };
  const expiredAt = clock.since + clock.remaining[clock.running];
  return now - expiredAt >= FLAG_GRACE_MS ? { loser: clock.running, mine: false } : null;
}

/** Stop both clocks (game over). */
export function stopClock(clock: ClockState | null, now: number): ClockState | null {
  return clock ? switchClock(clock, null, now, 0) : null;
}
