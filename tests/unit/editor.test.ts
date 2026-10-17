import { describe, expect, it } from "vitest";
import { START_PLACEMENT_FEN, buildFen, placementFromFen, placementToFen, possibleCastling, setupProblem } from "@/lib/chess/editor";

const ALL = { K: true, Q: true, k: true, q: true };

describe("board editor", () => {
  it("round-trips placements", () => {
    const p = placementFromFen(`${START_PLACEMENT_FEN} w KQkq - 0 1`);
    expect(p.e1).toBe("wK");
    expect(p.d8).toBe("bQ");
    expect(Object.keys(p)).toHaveLength(32);
    expect(placementToFen(p)).toBe(START_PLACEMENT_FEN);
    expect(placementToFen({})).toBe("8/8/8/8/8/8/8/8");
  });

  it("only keeps castling rights the pieces allow", () => {
    const p = placementFromFen("4k3/8/8/8/8/8/8/R3K3");
    expect(possibleCastling(p)).toEqual({ K: false, Q: true, k: false, q: false });
    expect(buildFen(p, "b", ALL)).toBe("4k3/8/8/8/8/8/8/R3K3 b Q - 0 1");
  });

  it("explains illegal setups", () => {
    expect(setupProblem(`${START_PLACEMENT_FEN} w KQkq - 0 1`)).toBeNull();
    expect(setupProblem("8/8/8/8/8/8/8/4K3 w - - 0 1")).toMatch(/Black needs a king/);
    expect(setupProblem("4k3/8/8/8/8/8/8/3KK3 w - - 0 1")).toMatch(/one king/);
    expect(setupProblem("P3k3/8/8/8/8/8/8/4K3 w - - 0 1")).toMatch(/Pawns/);
    // Black is in check with White to move.
    expect(setupProblem("4k3/8/8/8/8/8/8/4KR2 w - - 0 1")).toBeNull();
    expect(setupProblem("4k3/8/8/8/8/8/8/4R1K1 w - - 0 1")).toMatch(/Black is in check/);
  });
});
