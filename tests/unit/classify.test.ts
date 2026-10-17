import { describe, expect, it } from "vitest";
import { classifyMove, type ClassifyInput } from "@/lib/review/classify";
import { gameAccuracy, moveAccuracy } from "@/lib/review/accuracy";
import type { EngineLine } from "@/lib/engine/engine";
import type { Score } from "@/lib/engine/score";

const cp = (value: number): Score => ({ kind: "cp", value });
const mate = (value: number): Score => ({ kind: "mate", value });
const line = (score: Score, move: string, multipv = 1): EngineLine => ({ multipv, depth: 18, score, pv: [move] });

function input(partial: Partial<ClassifyInput>): ClassifyInput {
  return {
    mover: "w",
    playedUci: "a2a3",
    evalBefore: cp(0),
    evalAfter: cp(0),
    linesBefore: [line(cp(0), "e2e4")],
    legalMoveCount: 20,
    isBook: false,
    deliversMate: false,
    ...partial,
  };
}

describe("classifyMove", () => {
  it("labels the engine's top move as best regardless of eval noise", () => {
    const r = classifyMove(input({ playedUci: "e2e4", evalAfter: cp(-30) }));
    expect(r.classification).toBe("best");
    expect(r.winLoss).toBe(0);
  });

  it("treats evaluations from White's POV correctly for Black", () => {
    // Black to move at -1.00 (Black better). Black plays a move leaving 0.00.
    const r = classifyMove(
      input({ mover: "b", evalBefore: cp(-100), evalAfter: cp(0), linesBefore: [line(cp(-100), "e7e5")] }),
    );
    expect(r.winBefore).toBeGreaterThan(50);
    expect(r.winAfter).toBeCloseTo(50);
    expect(r.classification).toBe("inaccuracy");
  });

  it("does not flag a sign flip caused only by whose turn it is", () => {
    // Black keeps the same +0.20 (White POV) evaluation: no loss.
    const r = classifyMove(
      input({ mover: "b", evalBefore: cp(20), evalAfter: cp(20), linesBefore: [line(cp(20), "e7e5")] }),
    );
    expect(r.winLoss).toBeCloseTo(0);
    expect(r.classification).toBe("excellent");
  });

  it("grades by win% loss: small, medium, large", () => {
    expect(classifyMove(input({ evalBefore: cp(0), evalAfter: cp(-20) })).classification).toBe("excellent");
    expect(classifyMove(input({ evalBefore: cp(0), evalAfter: cp(-60) })).classification).toBe("inaccuracy");
    expect(classifyMove(input({ evalBefore: cp(0), evalAfter: cp(-130) })).classification).toBe("mistake");
    expect(classifyMove(input({ evalBefore: cp(0), evalAfter: cp(-400) })).classification).toBe("blunder");
  });

  it("is lenient in already-decided positions", () => {
    // +9 → +7 for White is still totally winning.
    const r = classifyMove(input({ evalBefore: cp(900), evalAfter: cp(700) }));
    expect(["excellent", "good"]).toContain(r.classification);
    // The same 2-pawn drop from equality is a blunder.
    expect(classifyMove(input({ evalBefore: cp(0), evalAfter: cp(-300) })).classification).toBe("blunder");
  });

  it("flags drawn → losing as a blunder", () => {
    expect(classifyMove(input({ evalBefore: cp(0), evalAfter: mate(-4) })).classification).toBe("blunder");
  });

  it("flags winning → drawn as a missed win", () => {
    expect(classifyMove(input({ evalBefore: cp(500), evalAfter: cp(0) })).classification).toBe("missed-win");
    expect(classifyMove(input({ evalBefore: mate(3), evalAfter: cp(0) })).classification).toBe("missed-win");
  });

  it("handles Black's missed mate", () => {
    const r = classifyMove(
      input({ mover: "b", evalBefore: mate(-2), evalAfter: cp(-50), linesBefore: [line(mate(-2), "d8h4")] }),
    );
    expect(r.winBefore).toBe(100);
    expect(r.classification).toBe("missed-win");
  });

  it("does not penalise a slower mate that stays winning", () => {
    const r = classifyMove(input({ evalBefore: mate(2), evalAfter: mate(5) }));
    expect(r.winLoss).toBe(0);
  });

  it("labels the only legal move as forced", () => {
    expect(classifyMove(input({ legalMoveCount: 1, evalAfter: cp(-900) })).classification).toBe("forced");
  });

  it("labels the mating move as best", () => {
    const r = classifyMove(input({ deliversMate: true, evalAfter: mate(1) }));
    expect(r.classification).toBe("best");
    expect(r.winAfter).toBe(100);
  });

  it("detects an only move from MultiPV", () => {
    const r = classifyMove(
      input({ playedUci: "e2e4", linesBefore: [line(cp(0), "e2e4"), line(cp(-400), "d2d4", 2)] }),
    );
    expect(r.classification).toBe("only");
  });

  it("does not call a move 'only' when already lost", () => {
    const r = classifyMove(
      input({ playedUci: "e2e4", evalBefore: cp(-800), linesBefore: [line(cp(-800), "e2e4"), line(mate(-3), "d2d4", 2)] }),
    );
    expect(r.classification).toBe("best");
  });

  it("respects book moves", () => {
    expect(classifyMove(input({ isBook: true, evalAfter: cp(-40) })).classification).toBe("book");
  });
});

describe("accuracy", () => {
  it("gives ~100 for no loss and drops with loss", () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 0);
    expect(moveAccuracy(10)).toBeLessThan(70);
    expect(moveAccuracy(100)).toBe(0);
  });

  it("aggregates with arithmetic + harmonic mean", () => {
    expect(gameAccuracy([])).toBeNull();
    expect(gameAccuracy([100, 100])).toBe(100);
    const mixed = gameAccuracy([100, 100, 100, 10]);
    expect(mixed).not.toBeNull();
    expect(mixed!).toBeLessThan(77.5); // below plain average
  });
});
