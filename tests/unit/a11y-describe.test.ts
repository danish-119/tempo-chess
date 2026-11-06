import { describe, expect, it } from "vitest";
import { describeMove } from "@/lib/a11y/describe";

describe("describeMove", () => {
  it("describes a quiet move", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1";
    expect(describeMove(fen, { from: "g1", to: "f3" })).toBe("White knight to f3.");
  });
  it("adds check and classification", () => {
    const fen = "rnbqkbnr/ppp2ppp/8/1B1pp3/8/4P3/PPPP1PPP/RNBQK1NR b KQkq - 1 3";
    expect(describeMove(fen, { from: "f1", to: "b5" }, "best")).toBe("White bishop to b5, check. Best.");
  });
  it("announces mate", () => {
    const fen = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(describeMove(fen, { from: "d8", to: "h4" })).toBe("Black queen to h4, checkmate.");
  });
  it("returns null without a move", () => {
    expect(describeMove("8/8/8/8/8/8/8/K1k5 w - - 0 1", null)).toBeNull();
  });
});
