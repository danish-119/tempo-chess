import { describe, expect, it } from "vitest";
import { PLAY_LEVELS, pickHumanMove } from "@/lib/play";

describe("bot ladder", () => {
  it("is ordered weakest to strongest", () => {
    expect(PLAY_LEVELS.map((b) => b.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const rates = PLAY_LEVELS.filter((b) => b.humanize).map((b) => b.humanize!.randomMoveRate);
    expect([...rates].sort((a, b) => b - a)).toEqual(rates); // more random = weaker, first
    const elos = PLAY_LEVELS.filter((b) => b.strength.elo).map((b) => b.strength.elo!);
    expect([...elos].sort((a, b) => a - b)).toEqual(elos);
  });
});

describe("pickHumanMove", () => {
  const legal = ["e2e4", "d2d4", "g1f3", "a2a3"];
  it("plays a random legal move at the random-move rate", () => {
    expect(pickHumanMove(["e2e4"], legal, { randomMoveRate: 0.5, topK: 3 }, () => 0.1)).toBe(legal[0]);
    const seq = [0.1, 0.99];
    let i = 0;
    expect(pickHumanMove(["e2e4"], legal, { randomMoveRate: 0.5, topK: 3 }, () => seq[i++])).toBe("a2a3");
  });
  it("otherwise picks among the top-K engine moves only", () => {
    const seq = [0.9, 0.99];
    let i = 0;
    expect(pickHumanMove(["d2d4", "e2e4", "g1f3", "a2a3"], legal, { randomMoveRate: 0.2, topK: 2 }, () => seq[i++])).toBe("e2e4");
  });
  it("never returns an illegal move", () => {
    expect(pickHumanMove(["h7h8"], legal, { randomMoveRate: 0, topK: 3 }, () => 0)).toBe("e2e4");
    expect(pickHumanMove([], [], { randomMoveRate: 0, topK: 3 })).toBeNull();
  });
});
