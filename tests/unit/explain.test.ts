import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { explainMove, type ExplainInput } from "@/lib/review/explain";
import type { Score } from "@/lib/engine/score";

function after(fen: string, uci: string): string {
  const c = new Chess(fen);
  c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return c.fen();
}

function make(fenBefore: string, played: string, partial: Partial<ExplainInput>): ExplainInput {
  const c = new Chess(fenBefore);
  const mover = c.turn();
  const san = c.move({ from: played.slice(0, 2), to: played.slice(2, 4) }).san;
  return {
    mover,
    classification: "blunder",
    fenBefore,
    fenAfter: after(fenBefore, played),
    playedSan: san,
    playedUci: played,
    evalBefore: { kind: "cp", value: 0 },
    evalAfter: { kind: "cp", value: 0 },
    bestLine: [],
    replyLine: [],
    deliversMate: false,
    ...partial,
  };
}

describe("explainMove", () => {
  it("detects a hanging piece only when the capture really wins material", () => {
    const fen = "k7/8/8/8/8/1r6/8/K2N4 w - - 0 1";
    const exp = explainMove(
      make(fen, "d1e3", {
        bestLine: ["d1b2"],
        replyLine: ["b3e3"],
        evalBefore: { kind: "cp", value: -200 },
        evalAfter: { kind: "cp", value: -500 },
      }),
    );
    expect(exp.motifs).toContain("hanging-piece");
    expect(exp.text).toMatch(/knight on e3/);
    expect(exp.verified).toBe(true);
  });

  it("detects a knight fork that wins the rook", () => {
    const fen = "r3k3/7p/8/1N6/8/8/8/4K3 b - - 0 1";
    const exp = explainMove(
      make(fen, "h7h6", {
        bestLine: ["a8a5"],
        replyLine: ["b5c7", "e8e7", "c7a8"],
        evalBefore: { kind: "cp", value: -100 },
        evalAfter: { kind: "cp", value: 400 },
      }),
    );
    expect(exp.motifs).toContain("fork");
    expect(exp.text).toMatch(/fork/);
  });

  it("does not claim a fork when no material is won", () => {
    const fen = "r3k3/7p/8/1N6/8/8/8/4K3 b - - 0 1";
    const exp = explainMove(
      make(fen, "h7h6", {
        classification: "inaccuracy",
        bestLine: ["a8a5"],
        replyLine: ["b5c7", "e8d7"], // engine line where the fork is not executed
        evalBefore: { kind: "cp", value: -100 },
        evalAfter: { kind: "cp", value: 0 },
      }),
    );
    expect(exp.motifs).not.toContain("fork");
  });

  it("explains an allowed back-rank mate and verifies it", () => {
    const fen = "6k1/5ppp/8/8/8/8/r4PPP/3R2K1 b - - 0 1";
    const mateScore: Score = { kind: "mate", value: 1 };
    const exp = explainMove(
      make(fen, "a2a3", { bestLine: ["a2a8"], replyLine: ["d1d8"], evalAfter: mateScore }),
    );
    expect(exp.motifs).toEqual(["allows-mate", "back-rank"]);
    expect(exp.verified).toBe(true);
    expect(exp.text).toMatch(/back-rank checkmate in 1/);
  });

  it("explains a missed mate", () => {
    const fen = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
    const exp = explainMove(
      make(fen, "g1f1", {
        classification: "missed-win",
        bestLine: ["d1d8"],
        evalBefore: { kind: "mate", value: 1 },
        evalAfter: { kind: "cp", value: 500 },
      }),
    );
    expect(exp.motifs).toContain("missed-mate");
    expect(exp.text).toMatch(/Rd8#/);
  });

  it("falls back to neutral wording when nothing is verifiable", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const exp = explainMove(
      make(fen, "g2g4", {
        classification: "inaccuracy",
        bestLine: ["e2e4", "e7e5"],
        replyLine: ["d7d5"],
        evalBefore: { kind: "cp", value: 30 },
        evalAfter: { kind: "cp", value: -60 },
      }),
    );
    expect(exp.verified).toBe(false);
    expect(exp.text).toMatch(/e4/);
  });

  it("ignores illegal engine lines instead of inventing moves", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const exp = explainMove(
      make(fen, "e2e4", { classification: "best", bestLine: ["e2e4"], replyLine: ["a1a8"] }),
    );
    expect(exp.text.length).toBeGreaterThan(5);
    expect(exp.text).not.toMatch(/Ra8|a1a8/);
  });
  it("describes a free capture from the board", () => {
    const fen = "4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1";
    const exp = explainMove(make(fen, "d1d5", { classification: "best", bestLine: ["d1d5"] }));
    expect(exp.motifs).toContain("free-piece");
    expect(exp.text).toMatch(/queen on d5/);
  });

  it("describes castling", () => {
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    const exp = explainMove(make(fen, "e1g1", { classification: "best", bestLine: ["e1g1"] }));
    expect(exp.motifs).toEqual(["castling"]);
    expect(exp.text).toMatch(/[Cc]astl/);
  });

  it("describes a check", () => {
    const fen = "4k3/8/8/8/8/8/8/R3K3 w - - 0 1";
    const exp = explainMove(make(fen, "a1a8", { classification: "good", bestLine: ["a1a8"] }));
    expect(exp.motifs).toContain("check");
  });

  it("recognises a smothered mate", () => {
    const fen = "6rk/6pp/8/6N1/8/8/8/K7 w - - 0 1";
    const exp = explainMove(make(fen, "g5f7", { classification: "best", deliversMate: true }));
    expect(exp.motifs).toEqual(["smothered-mate"]);
    expect(exp.text).toMatch(/[Ss]mothered/);
  });

  it("calls out a stalemate thrown away from a winning position", () => {
    const fen = "k7/8/1K6/8/8/8/8/2Q5 w - - 0 1";
    const exp = explainMove(
      make(fen, "c1c7", { classification: "blunder", evalBefore: { kind: "cp", value: 900 }, evalAfter: { kind: "cp", value: 0 } }),
    );
    expect(exp.motifs).toContain("stalemate");
    expect(exp.motifs).toContain("drawn-away");
    expect(exp.text).toMatch(/[Ss]talemate/);
  });

  it("keeps wording stable for the same move and varied across moves", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const texts = ["e2e4", "d2d4", "g1f3", "b1c3", "g2g3", "a2a3", "h2h3", "b2b3"].map((u) =>
      explainMove(make(start, u, { classification: "best", bestLine: [u] })).text,
    );
    const again = explainMove(make(start, "e2e4", { classification: "best", bestLine: ["e2e4"] })).text;
    expect(again).toBe(texts[0]);
    expect(new Set(texts).size).toBeGreaterThanOrEqual(5);
  });
});
