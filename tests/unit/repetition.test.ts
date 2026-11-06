import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { isThreefoldRepetition, positionKey } from "@/lib/chess/repetition";
import { START_FEN } from "@/lib/chess/types";

// Both sides shuffle a knight out and back: the start position occurs after 0, 4 and 8 plies.
const SHUFFLE = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];

describe("isThreefoldRepetition", () => {
  it("is false until the same position has occurred three times", () => {
    expect(isThreefoldRepetition([])).toBe(false);
    expect(isThreefoldRepetition(SHUFFLE.slice(0, 4))).toBe(false); // twice
    expect(isThreefoldRepetition(SHUFFLE.slice(0, 7))).toBe(false);
    expect(isThreefoldRepetition(SHUFFLE)).toBe(true); // third time
  });

  it("counts positions that are not consecutive and ignores move counters", () => {
    const withDetour = ["g1f3", "g8f6", "f3g1", "f6g8", "e2e3", "e7e6", "e3e2", "e6e7"]; // start position again, via different moves
    expect(isThreefoldRepetition(withDetour)).toBe(false); // only twice
    expect(positionKey("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 9")).toBe(positionKey(START_FEN));
  });

  it("only reports it when the last position is the repeated one", () => {
    expect(isThreefoldRepetition([...SHUFFLE, "e2e4"])).toBe(false);
  });

  it("is the case a FEN-only check misses", () => {
    const chess = new Chess();
    for (const m of SHUFFLE) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
    expect(chess.isThreefoldRepetition()).toBe(true); // with real history chess.js sees it
    expect(new Chess(chess.fen()).isThreefoldRepetition()).toBe(false); // rebuilt from FEN it cannot
    expect(isThreefoldRepetition(SHUFFLE)).toBe(true); // the move-based check does
  });
});
