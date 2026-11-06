import { describe, expect, it } from "vitest";
import { START_FEN } from "@/lib/chess/types";
import { parseMoveInput, piecePlacementText } from "@/lib/blindfold";

describe("parseMoveInput", () => {
  it("accepts SAN, coordinates and sloppy input", () => {
    expect(parseMoveInput(START_FEN, "e4")).toBe("e2e4");
    expect(parseMoveInput(START_FEN, "Nf3")).toBe("g1f3");
    expect(parseMoveInput(START_FEN, "e2e4")).toBe("e2e4");
    expect(parseMoveInput(START_FEN, "e2-e4")).toBe("e2e4");
    expect(parseMoveInput(START_FEN, " nf3 ")).toBe("g1f3");
  });
  it("rejects illegal or empty input", () => {
    expect(parseMoveInput(START_FEN, "e5")).toBeNull();
    expect(parseMoveInput(START_FEN, "")).toBeNull();
    expect(parseMoveInput(START_FEN, "zzz")).toBeNull();
  });
  it("handles castling with zeros", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(parseMoveInput(fen, "0-0")).toBe("e1g1");
    expect(parseMoveInput(fen, "O-O-O")).toBe("e1c1");
  });
});

describe("piecePlacementText", () => {
  it("lists the start position", () => {
    const t = piecePlacementText(START_FEN);
    expect(t.white).toContain("King e1");
    expect(t.black).toContain("Pawns a7, b7");
  });
});
