import { describe, expect, it } from "vitest";
import type { AnalysisSnapshot } from "@/lib/engine/engine";
import { START_FEN } from "@/lib/chess/types";
import { PLAY_LEVELS, chooseBotMove } from "@/lib/play";

const level = (n: number) => PLAY_LEVELS.find((l) => l.level === n)!;

/** A stand-in engine that returns a fixed analysis and records the request it received. */
function fakeEngine(snapshot: Partial<AnalysisSnapshot>) {
  const requests: unknown[] = [];
  return {
    requests,
    engine: {
      analyze: async (req: unknown) => {
        requests.push(req);
        return { fen: START_FEN, lines: [], depth: 10, bestmove: null, done: true, stopped: false, ...snapshot } as AnalysisSnapshot;
      },
    },
  };
}

describe("chooseBotMove", () => {
  it("plays the engine's best move at full strength and reports its evaluation", async () => {
    const { engine, requests } = fakeEngine({
      bestmove: "e2e4",
      lines: [{ multipv: 1, depth: 12, score: { kind: "cp", value: 35 }, pv: ["e2e4", "e7e5"] }],
    });
    const pick = await chooseBotMove(engine, START_FEN, level(10));
    expect(pick).toEqual({ uci: "e2e4", score: { kind: "cp", value: 35 } });
    expect(requests[0]).toMatchObject({ fen: START_FEN, movetimeMs: level(10).movetimeMs, strength: {} });
  });

  it("passes the strength limit of weaker levels to the engine", async () => {
    const { engine, requests } = fakeEngine({ bestmove: "d2d4", lines: [{ multipv: 1, depth: 8, score: { kind: "cp", value: 10 }, pv: ["d2d4"] }] });
    await chooseBotMove(engine, START_FEN, level(5));
    expect(requests[0]).toMatchObject({ strength: { elo: 1600 } });
  });

  it("never returns an illegal move", async () => {
    const { engine } = fakeEngine({ bestmove: "e2e5", lines: [] }); // not legal from the start position
    expect(await chooseBotMove(engine, START_FEN, level(10))).toBeNull();
  });

  it("returns null when the engine offers nothing", async () => {
    const { engine } = fakeEngine({ bestmove: null, lines: [] });
    expect(await chooseBotMove(engine, START_FEN, level(10))).toBeNull();
  });

  it("beginner levels always play a legal move, even when picking humanly", async () => {
    const lines = ["e2e4", "d2d4", "g1f3"].map((m, i) => ({ multipv: i + 1, depth: 4, score: { kind: "cp" as const, value: 20 - i }, pv: [m] }));
    const { engine } = fakeEngine({ bestmove: "e2e4", lines });
    for (let i = 0; i < 25; i++) {
      const pick = await chooseBotMove(engine, START_FEN, level(1));
      expect(pick).not.toBeNull();
      expect(pick!.uci).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    }
  });
});
