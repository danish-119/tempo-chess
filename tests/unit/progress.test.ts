import { describe, expect, it } from "vitest";
import {
  addDays,
  currentStreak,
  dailyPuzzleIndex,
  dateKey,
  emptyProgress,
  longestStreak,
  recordActivity,
  recordDaily,
  recordPuzzle,
  totals,
} from "@/lib/progress";

describe("dates", () => {
  it("formats and shifts local dates across month ends", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("streaks", () => {
  it("counts consecutive active days and keeps today's streak until midnight", () => {
    let p = emptyProgress();
    for (const d of ["2026-05-01", "2026-05-02", "2026-05-03"]) p = recordActivity(p, d);
    expect(currentStreak(p, "2026-05-03")).toBe(3);
    expect(currentStreak(p, "2026-05-04")).toBe(3); // today still empty: streak survives
    expect(currentStreak(p, "2026-05-05")).toBe(0); // a whole day missed
  });
  it("tracks the longest run", () => {
    let p = emptyProgress();
    for (const d of ["2026-05-01", "2026-05-02", "2026-05-04", "2026-05-05", "2026-05-06"]) p = recordActivity(p, d);
    expect(longestStreak(p)).toBe(3);
    expect(totals(p).activeDays).toBe(5);
  });
});

describe("puzzle rating", () => {
  it("rises on a hard solve, falls on a failed easy one and counts the day", () => {
    let p = emptyProgress();
    p = recordPuzzle(p, "2026-05-01", 1400, true);
    expect(p.rating.value).toBeGreaterThan(1000);
    const after = p.rating.value;
    p = recordPuzzle(p, "2026-05-01", 600, false);
    expect(p.rating.value).toBeLessThan(after);
    expect(p.days["2026-05-01"]).toEqual({ solved: 1, attempted: 2, other: 0 });
  });
});

describe("daily puzzle", () => {
  it("is deterministic per date and in range", () => {
    expect(dailyPuzzleIndex("2026-05-01", 1000)).toBe(dailyPuzzleIndex("2026-05-01", 1000));
    const picks = new Set(Array.from({ length: 20 }, (_, i) => dailyPuzzleIndex(addDays("2026-05-01", i), 1000)));
    expect(picks.size).toBeGreaterThan(10);
    for (const i of picks) expect(i).toBeLessThan(1000);
  });
  it("does not overwrite a solved daily", () => {
    let p = recordDaily(emptyProgress(), "2026-05-01", "abc", true);
    p = recordDaily(p, "2026-05-01", "abc", false);
    expect(p.daily["2026-05-01"].solved).toBe(true);
  });
});
