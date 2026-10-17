import { describe, expect, it } from "vitest";
import {
  evalBarFraction,
  formatScore,
  scoreToOrdinal,
  toWhitePov,
  winPercent,
  winPercentFor,
} from "@/lib/engine/score";
import { parseInfo, parseUciLine } from "@/lib/engine/uci";

describe("UCI parsing", () => {
  it("parses a full info line", () => {
    const info = parseInfo(
      "info depth 20 seldepth 28 multipv 2 score cp -35 nodes 123456 nps 999 hashfull 12 time 456 pv e7e5 g1f3 b8c6",
    );
    expect(info).toMatchObject({
      depth: 20,
      seldepth: 28,
      multipv: 2,
      score: { kind: "cp", value: -35 },
      nodes: 123456,
      nps: 999,
      timeMs: 456,
      pv: ["e7e5", "g1f3", "b8c6"],
    });
  });

  it("parses mate scores and bounds", () => {
    expect(parseInfo("info depth 5 score mate -3 pv a1a2").score).toEqual({ kind: "mate", value: -3 });
    const bound = parseInfo("info depth 9 score cp 50 lowerbound nodes 10 pv e2e4");
    expect(bound.bound).toBe("lower");
    expect(bound.nodes).toBe(10);
  });

  it("parses promotions in PVs and stops at non-moves", () => {
    expect(parseInfo("info depth 3 score cp 900 pv a7a8q b7b8n string done").pv).toEqual(["a7a8q", "b7b8n"]);
  });

  it("tolerates garbage", () => {
    expect(parseInfo("info depth x score foo 1 pv")).toEqual({ pv: [] });
  });

  it("parses bestmove, including (none)", () => {
    expect(parseUciLine("bestmove e2e4 ponder e7e5")).toEqual({ type: "bestmove", bestmove: "e2e4", ponder: "e7e5" });
    expect(parseUciLine("bestmove (none)")).toMatchObject({ type: "bestmove", bestmove: null });
    expect(parseUciLine("uciok").type).toBe("uciok");
    expect(parseUciLine("id name Stockfish 19")).toEqual({ type: "id", name: "Stockfish 19" });
  });
});

describe("score normalisation", () => {
  it("converts side-to-move scores to White's POV", () => {
    expect(toWhitePov({ kind: "cp", value: 40 }, "w")).toEqual({ kind: "cp", value: 40 });
    expect(toWhitePov({ kind: "cp", value: 40 }, "b")).toEqual({ kind: "cp", value: -40 });
    expect(toWhitePov({ kind: "mate", value: 2 }, "b")).toEqual({ kind: "mate", value: -2 });
  });

  it("computes symmetric win percentages", () => {
    expect(winPercent({ kind: "cp", value: 0 })).toBeCloseTo(50);
    const plus = winPercent({ kind: "cp", value: 300 });
    const minus = winPercent({ kind: "cp", value: -300 });
    expect(plus + minus).toBeCloseTo(100);
    expect(plus).toBeGreaterThan(75);
    expect(winPercentFor({ kind: "cp", value: 300 }, "b")).toBeCloseTo(minus);
    expect(winPercent({ kind: "mate", value: 3 })).toBe(100);
    expect(winPercent({ kind: "mate", value: -1 })).toBe(0);
  });

  it("orders mates above any centipawn score", () => {
    expect(scoreToOrdinal({ kind: "mate", value: 5 })).toBeGreaterThan(scoreToOrdinal({ kind: "cp", value: 5000 }));
    expect(scoreToOrdinal({ kind: "mate", value: 2 })).toBeGreaterThan(scoreToOrdinal({ kind: "mate", value: 5 }));
    expect(scoreToOrdinal({ kind: "mate", value: -2 })).toBeLessThan(scoreToOrdinal({ kind: "mate", value: -5 }));
  });

  it("formats scores", () => {
    expect(formatScore({ kind: "cp", value: 124 })).toBe("+1.24");
    expect(formatScore({ kind: "cp", value: -50 })).toBe("−0.50");
    expect(formatScore({ kind: "cp", value: 0 })).toBe("0.00");
    expect(formatScore({ kind: "mate", value: 3 })).toBe("M3");
    expect(formatScore({ kind: "mate", value: -2 })).toBe("−M2");
  });

  it("keeps the eval bar within bounds", () => {
    expect(evalBarFraction(null)).toBe(0.5);
    expect(evalBarFraction({ kind: "cp", value: 10000 })).toBeLessThanOrEqual(0.98);
    expect(evalBarFraction({ kind: "mate", value: -1 })).toBe(0);
  });
});
