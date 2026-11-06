import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { capturedPieces, describePieces } from "@/lib/chess/captured";
import { START_FEN } from "@/lib/chess/types";

function play(...sans: string[]): string {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

describe("capturedPieces", () => {
  it("is empty and level at the start", () => {
    expect(capturedPieces(START_FEN)).toEqual({ byWhite: [], byBlack: [], balance: 0 });
  });

  it("tracks captures and the material lead from the position", () => {
    const fen = play("e4", "d5", "exd5"); // White wins a pawn
    expect(capturedPieces(fen)).toEqual({ byWhite: ["p"], byBlack: [], balance: 1 });
    const traded = play("e4", "d5", "exd5", "Qxd5"); // Black recaptures
    expect(capturedPieces(traded)).toEqual({ byWhite: ["p"], byBlack: ["p"], balance: 0 });
  });

  it("lists pieces cheapest first and counts their value", () => {
    // Black has lost a knight and a pawn; White has lost a rook.
    const fen = "r1bqkbnr/ppppppp1/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1";
    const c = capturedPieces(fen);
    expect(c.byWhite).toEqual(["p", "n"]);
    expect(c.byBlack).toEqual(["r"]);
    expect(c.balance).toBe(-1); // White is a rook (5) down but up a knight and a pawn (4)
  });

  it("does not treat a promoted pawn as a captured pawn", () => {
    // White's h-pawn became a second queen (now on g3); every other white piece is still on the board.
    const fen = "rnbqkbnr/pppppppp/8/8/8/6Q1/PPPPPPP1/RNBQKBNR w KQkq - 0 1";
    const c = capturedPieces(fen);
    expect(c.byBlack).toEqual([]); // no white piece was taken
    expect(c.byWhite).toEqual([]);
    expect(c.balance).toBe(8); // a queen (9) gained for a pawn (1)
  });

  it("measures captures against a custom starting position", () => {
    const base = "4k3/8/8/8/8/8/PP6/4K2R w K - 0 1"; // White starts with two pawns and a rook
    expect(capturedPieces(base, base)).toEqual({ byWhite: [], byBlack: [], balance: 7 });
    const after = "4k3/8/8/8/8/8/P7/4K2R b K - 0 1"; // one pawn lost
    expect(capturedPieces(after, base).byBlack).toEqual(["p"]);
  });
});

describe("describePieces", () => {
  it("speaks counts with the right plurals", () => {
    expect(describePieces([])).toBe("");
    expect(describePieces(["p"])).toBe("1 pawn");
    expect(describePieces(["p", "p", "n", "q"])).toBe("2 pawns, 1 knight, 1 queen");
  });
});
