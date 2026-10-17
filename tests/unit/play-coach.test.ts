import { describe, expect, it } from "vitest";
import { type ClockState, formatMs, initClock, switchClock, timeLeft } from "@/lib/clock";
import { findThreat, gradeMove, nullMoveFen, pieceHint } from "@/lib/coach";
import type { AnalysisSnapshot } from "@/lib/engine/engine";
import type { Score } from "@/lib/engine/score";

function snap(fen: string, lines: [Score, string[]][]): AnalysisSnapshot {
  return {
    fen,
    lines: lines.map(([score, pv], i) => ({ multipv: i + 1, depth: 14, score, pv })),
    depth: 14,
    bestmove: lines[0]?.[1][0] ?? null,
    done: true,
    stopped: false,
  };
}

describe("clock", () => {
  it("runs, switches with increment and formats", () => {
    let c: ClockState = { ...initClock(60_000), running: "w", since: 0 };
    expect(timeLeft(c, "w", 10_000)).toBe(50_000);
    expect(timeLeft(c, "b", 10_000)).toBe(60_000);
    c = switchClock(c, "b", 10_000, 2_000);
    expect(c.remaining.w).toBe(52_000);
    expect(c.running).toBe("b");
    expect(timeLeft(c, "b", 70_000)).toBe(0);
    expect(formatMs(65_000)).toBe("1:05");
    expect(formatMs(9_450)).toBe("0:09.4");
  });
});

describe("coach", () => {
  const BACK_RANK = "6k1/5ppp/8/8/8/8/r4PPP/3R2K1 b - - 0 1";

  it("grades a blunder that allows mate, with a verified explanation", () => {
    const before = snap(BACK_RANK, [
      [{ kind: "cp", value: 0 }, ["h7h6"]],
      [{ kind: "cp", value: -10 }, ["g7g6"]],
    ]);
    const afterFen = "6k1/5ppp/8/8/8/r7/5PPP/3R2K1 w - - 1 2";
    const after = snap(afterFen, [[{ kind: "mate", value: 1 }, ["d1d8"]]]);
    const fb = gradeMove(BACK_RANK, "a2a3", before, after);
    expect(fb?.classification).toBe("blunder");
    expect(fb?.explanation.motifs).toContain("back-rank");
    expect(fb?.square).toBe("a3");
    expect(fb?.bestSan).toBe("h6");
  });

  it("grades the engine's top move as best", () => {
    const before = snap(BACK_RANK, [[{ kind: "cp", value: 0 }, ["h7h6"]]]);
    const after = snap("6k1/5pp1/7p/8/8/8/r4PPP/3R2K1 w - - 0 2", [[{ kind: "cp", value: 0 }, ["g1f1"]]]);
    expect(gradeMove(BACK_RANK, "h7h6", before, after)?.classification).toBe("best");
  });

  it("builds a null-move FEN only when legal", () => {
    expect(nullMoveFen("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1")?.split(" ")[1]).toBe("b");
    expect(nullMoveFen("3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1")).toBeNull(); // side to move in check
  });

  it("reports a real threat only", () => {
    const quiet = "6k1/5ppp/8/8/8/8/r4PPP/3R2K1 w - - 0 1";
    const current = snap(quiet, [[{ kind: "cp", value: 300 }, ["d1d8"]]]);
    const nm = snap(nullMoveFen(quiet)!, [[{ kind: "cp", value: 280 }, ["a2a1"]]]);
    expect(findThreat(quiet, "w", current, nm)).toBeNull(); // only 2-3% swing
    const big = snap(nullMoveFen(quiet)!, [[{ kind: "cp", value: -400 }, ["a2f2"]]]);
    const t = findThreat(quiet, "w", current, big);
    expect(t?.from).toBe("a2");
    expect(t?.text).toMatch(/pawn on f2/);
  });

  it("gives a piece hint without the destination", () => {
    const h = pieceHint("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "d1d8");
    expect(h).toEqual({ square: "d1", text: "Look for a good move with your rook on d1." });
  });
});
