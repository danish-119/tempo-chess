import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { boardRows } from "@/lib/boardImage";
import { isLightSquare, nameChoices, randomSquare } from "@/lib/coordinates";
import { ENDGAME_LESSONS, isWorse, mistakeText } from "@/lib/endgames";
import { OPENINGS } from "@/lib/learn/openings";
import { TACTICS, examplesFor } from "@/lib/learn/tactics";
import { THEME_LABEL, type Puzzle } from "@/lib/puzzles";
import { decodeShare, encodeShare, shareTokenFromHash } from "@/lib/share";
import { buildLine, buildUciLine } from "@/app/learn/LineViewer";
import { START_FEN } from "@/lib/chess/types";
import { pieceCount } from "@/lib/tablebase";

describe("learn: openings", () => {
  it("every main line is legal and ids are unique", () => {
    expect(new Set(OPENINGS.map((o) => o.id)).size).toBe(OPENINGS.length);
    for (const o of OPENINGS) {
      const line = buildLine(START_FEN, o.moves.split(" "));
      expect(line.length, o.name).toBeGreaterThan(5);
      expect(o.ideas.length).toBeGreaterThan(0);
    }
  });

  it("builds UCI lines with promotions", () => {
    const line = buildUciLine("8/P6k/8/8/8/8/8/K7 w - - 0 1", ["a7a8q"]);
    expect(line[0].san).toBe("a8=Q");
  });
});

describe("learn: tactics", () => {
  it("uses labelled puzzle themes and picks the easiest examples", () => {
    for (const t of TACTICS) expect(THEME_LABEL[t.theme], t.theme).toBeTruthy();
    const ps: Puzzle[] = [
      { id: "a", fen: "", moves: "", rating: 1500, themes: ["fork"] },
      { id: "b", fen: "", moves: "", rating: 800, themes: ["fork"] },
      { id: "c", fen: "", moves: "", rating: 600, themes: ["pin"] },
    ];
    expect(examplesFor(ps, "fork").map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("endgame trainer", () => {
  it("has legal tablebase-sized start positions", () => {
    expect(new Set(ENDGAME_LESSONS.map((l) => l.id)).size).toBe(ENDGAME_LESSONS.length);
    for (const l of ENDGAME_LESSONS) {
      expect(() => new Chess(l.fen), l.id).not.toThrow();
      expect(pieceCount(l.fen), l.id).toBeLessThanOrEqual(7);
      if (l.goal === "draw") expect(l.holdMoves, l.id).toBeGreaterThan(0);
    }
  });

  it("judges results", () => {
    expect(isWorse("win", "draw")).toBe(true);
    expect(isWorse("draw", "loss")).toBe(true);
    expect(isWorse("draw", "draw")).toBe(false);
    expect(isWorse("win", "unknown")).toBe(false);
    expect(mistakeText("win", "draw")).toMatch(/throws away the win/);
  });
});

describe("sharing", () => {
  it("round-trips a PGN through a compressed URL fragment", async () => {
    const pgn = '[Event "Test"]\n[White "A"]\n[Black "B"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *';
    const token = await encodeShare(pgn);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeShare(token)).toBe(pgn);
    expect(shareTokenFromHash(`#pgn=${token}`)).toBe(token);
    expect(shareTokenFromHash("#other")).toBeNull();
  });

  it("parses board rows for the image export", () => {
    const rows = boardRows(START_FEN);
    expect(rows).toHaveLength(8);
    expect(rows[0][4]).toBe("bK");
    expect(rows[4].every((c) => c === null)).toBe(true);
  });
});

describe("coordinates", () => {
  it("never repeats the previous square", () => {
    const seq = [0, 0, 0, 0, 0.5, 0.5];
    const rnd = () => seq.shift() ?? 0.9;
    expect(randomSquare("a1", rnd)).toBe("e5");
    expect(randomSquare(null, () => 0.99)).toBe("h8");
  });

  it("knows square colours and offers four distinct nearby names", () => {
    expect(isLightSquare("a1")).toBe(false);
    expect(isLightSquare("h1")).toBe(true);
    expect(isLightSquare("e4")).toBe(true);
    expect(isLightSquare("d4")).toBe(false);
    for (const sq of ["a1", "e4", "h8"]) {
      const c = nameChoices(sq);
      expect(c).toHaveLength(4);
      expect(new Set(c).size).toBe(4);
      expect(c).toContain(sq);
    }
  });
});
