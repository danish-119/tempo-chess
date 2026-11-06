import { describe, expect, it } from "vitest";
import {
  addDays,
  addMistakes,
  currentStreak,
  dailyPuzzleIndex,
  dateKey,
  dueMistakes,
  emptyProgress,
  exportProgress,
  gradeMistake,
  longestStreak,
  mergeProgress,
  parseProgress,
  recordActivity,
  recordDaily,
  recordPuzzle,
  recordRush,
  totals,
} from "@/lib/progress";

const mistake = (id: string) => ({
  id,
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  playedUci: "g2g4",
  playedSan: "g4",
  bestUci: "e2e4",
  bestSan: "e4",
  classification: "mistake",
  gameLabel: "Test game",
});

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

describe("mistake bank", () => {
  it("adds without duplicates and schedules reviews", () => {
    let p = addMistakes(emptyProgress(), [mistake("g1:5")], "2026-05-01");
    p = addMistakes(p, [mistake("g1:5"), mistake("g1:9")], "2026-05-01");
    expect(p.mistakes).toHaveLength(2);
    expect(dueMistakes(p, "2026-05-01")).toHaveLength(2);
    p = gradeMistake(p, "g1:5", true, "2026-05-01");
    expect(dueMistakes(p, "2026-05-01")).toHaveLength(1);
    expect(p.mistakes.find((m) => m.id === "g1:5")?.due).toBe("2026-05-02");
    p = gradeMistake(p, "g1:5", false, "2026-05-02");
    const m = p.mistakes.find((x) => x.id === "g1:5");
    expect(m?.box).toBe(0);
    expect(m?.due).toBe("2026-05-03");
  });
});

describe("export and import", () => {
  it("round-trips and merges", () => {
    let a = recordPuzzle(emptyProgress(), "2026-05-01", 1200, true);
    a = recordRush(a, "2026-05-01", "3min", 12);
    const parsed = parseProgress(exportProgress(a));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.progress.rushBest["3min"]).toBe(12);
    const b = recordActivity(emptyProgress(), "2026-05-02");
    const merged = mergeProgress(a, b);
    expect(Object.keys(merged.days)).toEqual(["2026-05-01", "2026-05-02"]);
  });
  it("rejects wrong or damaged files", () => {
    expect(parseProgress("not json").ok).toBe(false);
    expect(parseProgress(JSON.stringify({ hello: "world" })).ok).toBe(false);
    expect(parseProgress(JSON.stringify({ app: "tempo", kind: "progress", progress: { rating: "x" } })).ok).toBe(false);
  });
});
