import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { createLocalGame, currentFen, extendLocalGame, initNav, lastMove, navReducer } from "@/lib/chess/navigation";
import { exportAnnotatedPgn, exportPgn } from "@/lib/chess/export";
import { parseSingleGame } from "@/lib/chess/pgn";
import { START_FEN } from "@/lib/chess/types";
import { buildReview } from "@/lib/review/review";
import type { PositionEval } from "@/lib/review/types";
import { REVIEW_PRESETS } from "@/lib/review/review";

const PGN = `[Event "T"]\n[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;
const game = parseSingleGame(PGN);

describe("navigation reducer", () => {
  it("navigates the mainline within bounds", () => {
    let s = initNav(game);
    expect(currentFen(s)).toBe(START_FEN);
    s = navReducer(s, { type: "prev" });
    expect(s.ply).toBe(0);
    s = navReducer(s, { type: "last" });
    expect(s.ply).toBe(7);
    s = navReducer(s, { type: "next" });
    expect(s.ply).toBe(7);
    s = navReducer(s, { type: "goto", ply: 3 });
    expect(currentFen(s)).toBe(game.moves[2].fenAfter);
    expect(lastMove(s)).toEqual({ from: "f1", to: "c4" });
  });

  it("follows the mainline when the played move matches", () => {
    const s = navReducer(initNav(game, 2), { type: "play", uci: "f1c4" });
    expect(s.ply).toBe(3);
    expect(s.variation).toBeNull();
  });

  it("creates a variation without touching the game", () => {
    let s = navReducer(initNav(game, 2), { type: "play", uci: "g1f3" });
    expect(s.variation?.basePly).toBe(2);
    expect(s.variation?.moves[0].san).toBe("Nf3");
    s = navReducer(s, { type: "play", uci: "b8c6" });
    expect(s.variation?.moves).toHaveLength(2);
    s = navReducer(s, { type: "prev" });
    expect(s.variation?.index).toBe(1);
    // Branching from inside a variation truncates its tail.
    s = navReducer(s, { type: "play", uci: "d7d6" });
    expect(s.variation?.moves.map((m) => m.san)).toEqual(["Nf3", "d6"]);
    expect(s.game.moves).toHaveLength(7); // original untouched
    s = navReducer(s, { type: "exit-variation" });
    expect(s.variation).toBeNull();
    expect(s.ply).toBe(2);
  });

  it("ignores illegal moves", () => {
    const s0 = initNav(game);
    expect(navReducer(s0, { type: "play", uci: "e2e5" })).toBe(s0);
  });

  it("loads an engine line and stops at illegal moves", () => {
    const s = navReducer(initNav(game, 0), { type: "line", basePly: 0, ucis: ["d2d4", "d7d5", "a1a8"], index: 2 });
    expect(s.variation?.moves).toHaveLength(2);
    expect(s.variation?.index).toBe(2);
  });

  it("previous from the variation start returns to the mainline", () => {
    let s = navReducer(initNav(game, 2), { type: "line", basePly: 2, ucis: ["g1f3"], index: 0 });
    s = navReducer(s, { type: "prev" });
    expect(s.variation).toBeNull();
    expect(s.ply).toBe(2);
  });
});

describe("local games", () => {
  it("extends and truncates a free-analysis game", () => {
    let g = createLocalGame(START_FEN);
    g = extendLocalGame(g, 0, "e2e4")!;
    g = extendLocalGame(g, 1, "e7e5")!;
    expect(g.moves.map((m) => m.san)).toEqual(["e4", "e5"]);
    const branched = extendLocalGame(g, 1, "c7c5")!;
    expect(branched.moves.map((m) => m.san)).toEqual(["e4", "c5"]);
    expect(extendLocalGame(g, 2, "e1e3")).toBeNull();
  });
});

describe("PGN export", () => {
  it("round-trips the mainline", () => {
    const again = parseSingleGame(exportPgn(game));
    expect(again.moves.map((m) => m.uci)).toEqual(game.moves.map((m) => m.uci));
    expect(again.metadata.result).toBe("1-0");
  });

  it("round-trips custom start positions", () => {
    const g = parseSingleGame(`[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 40"]\n[Result "*"]\n\n40... Kd7 41. e4 *`);
    const again = parseSingleGame(exportPgn(g));
    expect(again.startFen).toBe(g.startFen);
    expect(again.moves.map((m) => m.san)).toEqual(["Kd7", "e4"]);
  });

  it("produces a re-parseable annotated PGN that preserves the mainline", () => {
    const positions: PositionEval[] = [game.startFen, ...game.moves.map((m) => m.fenAfter)].map((fen, i) => {
      const c = new Chess(fen);
      const terminal = c.isCheckmate() ? "checkmate" : null;
      const best = c.moves({ verbose: true })[0];
      return {
        fen,
        lines: terminal ? [] : [{ multipv: 1, depth: 10, score: { kind: "cp", value: i === 6 ? 10000 : 20 }, pv: [`${best.from}${best.to}`] }],
        score: terminal ? { kind: "mate", value: 0 } : { kind: "cp", value: 20 },
        depth: 10,
        terminal,
        bestmove: terminal ? null : `${best.from}${best.to}`,
      } as PositionEval;
    });
    const review = buildReview(game, positions, REVIEW_PRESETS.quick, "Stockfish test", null);
    const annotated = exportAnnotatedPgn(game, review);
    expect(annotated).toContain("[%eval");
    expect(annotated).toContain("[Annotator");
    const again = parseSingleGame(annotated);
    expect(again.moves.map((m) => m.uci)).toEqual(game.moves.map((m) => m.uci));
    // The original PGN is untouched.
    expect(game.originalPgn).toBe(PGN.trim());
  });
});
