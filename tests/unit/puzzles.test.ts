import { describe, expect, it } from "vitest";
import { type Puzzle, isCorrectMove, matching, pickRandom, preparePuzzle, themeOptions } from "@/lib/puzzles";

// Real Lichess-format puzzle: Black plays Rxd1?? / the solver (White) mates.
const BACK_RANK: Puzzle = {
  id: "test1",
  fen: "6k1/5ppp/8/8/8/8/r4PPP/3R2K1 b - - 0 1",
  moves: "a2a3 d1d8",
  rating: 800,
  themes: ["mateIn1", "backRankMate"],
};

describe("puzzles", () => {
  it("prepares the solver position after the opponent's setup move", () => {
    const p = preparePuzzle(BACK_RANK)!;
    expect(p.setupMove).toBe("a2a3");
    expect(p.solver).toBe("w");
    expect(p.solution).toEqual(["d1d8"]);
    expect(p.startFen.split(" ")[1]).toBe("w");
  });

  it("rejects malformed puzzles", () => {
    expect(preparePuzzle({ ...BACK_RANK, moves: "a1a8" })).toBeNull();
    expect(preparePuzzle({ ...BACK_RANK, moves: "a2a3" })).toBeNull();
  });

  it("accepts the expected move and any alternative checkmate", () => {
    const p = preparePuzzle(BACK_RANK)!;
    expect(isCorrectMove(p.startFen, p.solution, 0, "d1d8")).toBe(true);
    expect(isCorrectMove(p.startFen, p.solution, 0, "d1d7")).toBe(false);
    // Two rooks: either rook mates on the back rank.
    const fen = "6k1/5ppp/8/8/8/8/5PPP/R2R2K1 w - - 0 1";
    expect(isCorrectMove(fen, ["d1d8"], 0, "a1a8")).toBe(true);
  });

  it("filters by level and theme and picks unseen puzzles first", () => {
    const pool: Puzzle[] = [
      { ...BACK_RANK, id: "a", rating: 900 },
      { ...BACK_RANK, id: "b", rating: 1500, themes: ["fork"] },
      { ...BACK_RANK, id: "c", rating: 2400, themes: ["fork"] },
    ];
    expect(matching(pool, { min: 0, max: 1000, theme: null }).map((p) => p.id)).toEqual(["a"]);
    expect(matching(pool, { min: 0, max: 9999, theme: "fork" }).map((p) => p.id)).toEqual(["b", "c"]);
    expect(pickRandom(pool, new Set(["a", "b"]))?.id).toBe("c");
    expect(pickRandom(pool, new Set(["a", "b", "c"]), () => 0)?.id).toBe("a");
    expect(pickRandom([], new Set())).toBeNull();
  });

  it("lists themes with enough puzzles", () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({ ...BACK_RANK, id: String(i) }));
    expect(themeOptions(pool).map((t) => t.id)).toEqual(["backRankMate", "mateIn1"]);
  });
});
