import { beforeEach, describe, expect, it } from "vitest";
import type { Puzzle } from "@/lib/puzzles";
import { loadBest, pickRushPuzzle, rushTargetRating, saveBest } from "@/lib/rush";

const puzzle = (id: string, rating: number): Puzzle => ({ id, fen: `fen-${id}`, moves: "e2e4 e7e5", rating, themes: [] });

describe("puzzle rush", () => {
  beforeEach(() => localStorage.clear());

  it("ramps the target rating and caps it", () => {
    expect(rushTargetRating(0)).toBe(600);
    expect(rushTargetRating(10)).toBe(1150);
    expect(rushTargetRating(1000)).toBe(2900);
  });

  it("picks near the target, skips seen puzzles and widens when needed", () => {
    const all = [puzzle("a", 600), puzzle("b", 650), puzzle("c", 2000)];
    expect(["a", "b"]).toContain(pickRushPuzzle(all, 0, new Set())?.id);
    expect(pickRushPuzzle(all, 0, new Set(["a", "b"]))?.id).toBe("c");
    expect(pickRushPuzzle(all, 0, new Set(["a", "b", "c"]))).toBeNull();
  });

  it("stores only new best scores per mode", () => {
    expect(loadBest("3min")).toBe(0);
    expect(saveBest("3min", 12)).toBe(true);
    expect(saveBest("3min", 10)).toBe(false);
    expect(loadBest("3min")).toBe(12);
    expect(loadBest("5min")).toBe(0);
  });
});
