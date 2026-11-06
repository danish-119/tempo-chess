import { describe, expect, it } from "vitest";
import { TIME_CONTROLS, timeLeft } from "@/lib/clock";
import { FLAG_GRACE_MS, afterLocalMove, afterRemoteMove, startOnlineClock, stopClock, timeoutVerdict } from "@/lib/online/clock";
import { parseMessage } from "@/lib/online/protocol";

const tc = (id: string) => TIME_CONTROLS.find((t) => t.id === id)!;

describe("online clock", () => {
  it("is absent for untimed games and starts with White running", () => {
    expect(startOnlineClock(tc("none"), 0)).toBeNull();
    const c = startOnlineClock(tc("5+0"), 1000)!;
    expect(c.running).toBe("w");
    expect(c.remaining).toEqual({ w: 300_000, b: 300_000 });
  });

  it("deducts my thinking time, adds the increment and reports what is left", () => {
    const c = startOnlineClock(tc("3+2"), 0)!;
    const res = afterLocalMove(c, "w", tc("3+2"), 5000);
    expect(res.ms).toBe(180_000 - 5000 + 2000);
    expect(res.clock.running).toBe("b");
  });

  it("accepts the opponent's reported time", () => {
    let c = startOnlineClock(tc("5+0"), 0)!;
    c = afterLocalMove(c, "w", tc("5+0"), 3000).clock; // I am White and moved; Black is thinking
    c = afterRemoteMove(c, "w", tc("5+0"), 290_000, 12_000); // Black replied, claims 290 s left
    expect(c.remaining.b).toBe(290_000);
    expect(c.running).toBe("w");
  });

  it("never lets the opponent claim more time than their turn started with plus the increment", () => {
    let c = startOnlineClock(tc("3+2"), 0)!;
    c = afterLocalMove(c, "w", tc("3+2"), 1000).clock;
    c = afterRemoteMove(c, "w", tc("3+2"), 999_999, 2000); // cheating claim
    expect(c.remaining.b).toBe(180_000 + 2000);
    c = afterLocalMove(c, "w", tc("3+2"), 4000).clock;
    c = afterRemoteMove(c, "w", tc("3+2"), -50, 5000);
    expect(c.remaining.b).toBe(0);
  });

  it("falls back to its own estimate when no time is sent", () => {
    let c = startOnlineClock(tc("5+0"), 0)!;
    c = afterLocalMove(c, "w", tc("5+0"), 0).clock;
    c = afterRemoteMove(c, "w", tc("5+0"), undefined, 10_000);
    expect(c.remaining.b).toBe(290_000);
  });

  it("makes me declare my own timeout immediately and waits a grace period for the opponent's", () => {
    const c = startOnlineClock(tc("1+0"), 0)!; // White (me) running
    expect(timeoutVerdict(c, "w", 59_000)).toBeNull();
    expect(timeoutVerdict(c, "w", 60_000)).toEqual({ loser: "w", mine: true });

    const theirs = afterLocalMove(c, "w", tc("1+0"), 1000).clock; // Black running from t=1000
    const expiredAt = 1000 + 60_000;
    expect(timeoutVerdict(theirs, "w", expiredAt + 100)).toBeNull(); // grace period
    expect(timeoutVerdict(theirs, "w", expiredAt + FLAG_GRACE_MS)).toEqual({ loser: "b", mine: false });
  });

  it("stops the clock when the game ends", () => {
    const c = startOnlineClock(tc("5+0"), 0)!;
    const stopped = stopClock(c, 10_000)!;
    expect(stopped.running).toBeNull();
    expect(timeLeft(stopped, "w", 99_999)).toBe(290_000);
    expect(stopClock(null, 0)).toBeNull();
  });
});

describe("protocol carries the time control and clock", () => {
  it("accepts tc, ms and flag messages", () => {
    expect(parseMessage('{"t":"start","guestColor":"b","game":1,"tc":"5+0"}')).toMatchObject({ tc: "5+0" });
    expect(parseMessage('{"t":"move","uci":"e2e4","ply":1,"ms":299000}')).toMatchObject({ ms: 299000 });
    expect(parseMessage('{"t":"flag"}')).toEqual({ t: "flag" });
    expect(parseMessage('{"t":"move","uci":"e2e4","ply":1,"ms":-5}')).toBeNull();
  });
});
