import { describe, expect, it } from "vitest";
import { explorerUrl, shares } from "@/lib/lichess/explorer";
import { pkceChallenge, safeReturnPath } from "@/lib/lichess/auth";
import { distanceLabel, moveOutcome, outcomeOf, pieceCount, tablebaseApplies, verdict } from "@/lib/tablebase";

describe("tablebase", () => {
  it("counts pieces and applies to ≤ 7", () => {
    expect(pieceCount("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(32);
    expect(tablebaseApplies("4k3/6KP/8/8/8/8/7p/8 w - - 0 1")).toBe(true);
    expect(tablebaseApplies("4k3/pppp4/8/8/8/8/PPPP4/4K3 w - - 0 1")).toBe(false);
  });

  it("maps categories and distances", () => {
    expect(outcomeOf("cursed-win")).toBe("draw");
    expect(outcomeOf("syzygy-loss")).toBe("loss");
    expect(moveOutcome({ uci: "h7h8q", san: "h8=Q+", category: "loss" })).toBe("win");
    expect(distanceLabel(17, 1)).toBe("Mate in 9");
    expect(distanceLabel(null, -12)).toBe("DTZ 12");
    expect(distanceLabel(0, 0)).toBeNull();
    expect(verdict({ category: "win", dtm: 17, dtz: 1, moves: [] }, "w")).toBe("White wins · Mate in 9");
    expect(verdict({ category: "loss", dtm: -16, dtz: -2, moves: [] }, "b")).toBe("White wins · Mate in 8");
    expect(verdict({ category: "draw", dtm: 0, dtz: 0, moves: [] }, "w")).toBe("Draw");
  });
});

describe("opening explorer", () => {
  it("builds allow-listed URLs", () => {
    const u = new URL(explorerUrl("lichess", "8/8/8/8/8/8/8/K6k w - - 0 1"));
    expect(u.origin).toBe("https://explorer.lichess.org");
    expect(u.pathname).toBe("/lichess");
    expect(u.searchParams.get("speeds")).toBe("blitz,rapid,classical");
    expect(new URL(explorerUrl("masters", "x")).searchParams.has("speeds")).toBe(false);
  });

  it("computes result shares summing to 100", () => {
    expect(shares({ white: 1, draws: 1, black: 1 }).reduce((a, b) => a + b)).toBe(100);
    expect(shares({ white: 0, draws: 0, black: 0 })).toEqual([0, 0, 0]);
  });
});

describe("lichess auth", () => {
  it("computes the RFC 7636 S256 challenge", async () => {
    // Example from RFC 7636, appendix B.
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("only returns to local paths", () => {
    expect(safeReturnPath("/analyze?panel=explorer")).toBe("/analyze?panel=explorer");
    expect(safeReturnPath("//evil.example")).toBe("/analyze");
    expect(safeReturnPath("https://evil.example")).toBe("/analyze");
    expect(safeReturnPath(null)).toBe("/analyze");
  });
});
