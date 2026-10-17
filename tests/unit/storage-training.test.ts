import { beforeEach, describe, expect, it } from "vitest";
import { parseSingleGame } from "@/lib/chess/pgn";
import { detectPhases } from "@/lib/review/phases";
import { computeTimings, formatClock, parseTimeControl } from "@/lib/review/time";
import { buildReview, REVIEW_PRESETS } from "@/lib/review/review";
import type { PositionEval } from "@/lib/review/types";
import {
  __resetStorageForTests,
  clearAll,
  deleteGame,
  getGame,
  getReview,
  listGames,
  saveGame,
  saveReview,
} from "@/lib/storage/db";

const PGN = `[White "me"]\n[Black "opp"]\n[Result "1-0"]\n[TimeControl "60"]\n\n1. e4 {[%clk 0:01:00]} e5 {[%clk 0:00:59]} 2. Qh5 {[%clk 0:00:50]} Nc6 {[%clk 0:00:58]} 3. Bc4 {[%clk 0:00:40]} Nf6 {[%clk 0:00:55]} 4. Qxf7# {[%clk 0:00:05]} 1-0`;
const game = parseSingleGame(PGN);

/** Synthetic engine evals: Black's 3...Nf6 is a blunder (allows mate in 1). */
function positions(): PositionEval[] {
  const fens = [game.startFen, ...game.moves.map((m) => m.fenAfter)];
  return fens.map((fen, i) => {
    if (i === 7) return { fen, lines: [], score: { kind: "mate", value: 0 }, depth: 0, terminal: "checkmate", bestmove: null };
    const best = game.moves[i]?.uci ?? "a2a3";
    const score = i === 5 ? { kind: "cp" as const, value: 30 } : i === 6 ? { kind: "mate" as const, value: 1 } : { kind: "cp" as const, value: 20 };
    const lines =
      i === 5
        ? [
            { multipv: 1, depth: 16, score, pv: ["d8e7"] },
            { multipv: 2, depth: 16, score: { kind: "cp" as const, value: 40 }, pv: ["g7g6"] },
          ]
        : [{ multipv: 1, depth: 16, score, pv: [best] }];
    return { fen, lines, score, depth: 16, terminal: null, bestmove: lines[0].pv[0] };
  });
}

describe("review pipeline (pure)", () => {
  const review = buildReview(game, positions(), REVIEW_PRESETS.standard, "Stockfish", null);

  it("classifies the blunder and the mate", () => {
    const nf6 = review.moves[5];
    expect(nf6.san).toBe("Nf6");
    expect(nf6.classification).toBe("blunder");
    expect(nf6.explanation.motifs).toContain("allows-mate");
    expect(review.moves[6].classification).toBe("best");
    expect(review.moves[6].explanation.text).toBe("Checkmate.");
    expect(nf6.keyMoment).toBe(true);
  });

  it("summarises per player", () => {
    expect(review.black.counts.blunder).toBe(1);
    expect(review.white.accuracy).not.toBeNull();
    expect(review.black.accuracy!).toBeLessThan(review.white.accuracy!);
  });
});

describe("time & phases", () => {
  it("computes time spent and pressure", () => {
    const t = computeTimings(game.moves, parseTimeControl("60"));
    expect(t[0].timeSpentSeconds).toBe(0);
    expect(t[2].timeSpentSeconds).toBe(10);
    expect(t[6].timeSpentSeconds).toBe(35);
    expect(t[6].underTimePressure).toBe(false); // 40s left before the move ≥ 6s line
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(5.5)).toBe("0:05.5");
    expect(parseTimeControl("1/86400")).toBeNull();
  });

  it("detects phases", () => {
    const phases = detectPhases(game.moves.map((m) => m.fenBefore), 0);
    expect(phases.every((p) => p === "opening")).toBe(true);
    const endgame = detectPhases(["8/8/4k3/8/8/3K4/4P3/8 w - - 0 1"], 0);
    expect(endgame).toEqual(["endgame"]);
  });
});

describe("storage", () => {
  beforeEach(async () => {
    __resetStorageForTests();
    await clearAll();
  });

  it("saves, lists, reads and deletes games with their reviews and cards", async () => {
    await saveGame(game, { perspective: "w" });
    expect((await listGames()).map((g) => g.id)).toEqual([game.id]);
    const review = buildReview(game, positions(), REVIEW_PRESETS.standard, "Stockfish", null);
    await saveReview(review);
    expect((await getGame(game.id))?.hasReview).toBe(true);
    expect((await getReview(game.id))?.moves).toHaveLength(7);
    await deleteGame(game.id);
    expect(await getGame(game.id)).toBeNull();
    expect(await getReview(game.id)).toBeNull();
  });
});

describe("review upgrades", () => {
  it("re-classifies an old review from its stored engine output", async () => {
    const { upgradeReview } = await import("@/lib/review/review");
    const current = buildReview(game, positions(), REVIEW_PRESETS.standard, "Stockfish", null);
    const old = { ...current, version: 1, moves: current.moves.map((m) => ({ ...m, classification: "good" as const })) };
    const upgraded = upgradeReview(game, old, null);
    expect(upgraded.version).toBe(current.version);
    expect(upgraded.moves[5].classification).toBe("blunder");
    expect(upgraded.white.counts.brilliant).toBe(0);
  });
});
