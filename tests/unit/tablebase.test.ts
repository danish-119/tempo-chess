import { describe, expect, it } from "vitest";
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
