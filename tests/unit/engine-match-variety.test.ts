import { describe, expect, it } from "vitest";
import type { AnalysisRequest, AnalysisSnapshot, EngineLine } from "@/lib/engine/engine";
import { START_FEN } from "@/lib/chess/types";
import { PLAY_LEVELS, chooseBotMove } from "@/lib/play";

const max = PLAY_LEVELS.find((l) => l.level === 10)!;
const beginner = PLAY_LEVELS.find((l) => l.level === 1)!;
const line = (multipv: number, value: number, move: string): EngineLine => ({ multipv, depth: 12, score: { kind: "cp", value }, pv: [move] });

function fake(lines: EngineLine[], bestmove: string) {
  const requests: AnalysisRequest[] = [];
  return {
    requests,
    engine: {
      analyze: async (req: AnalysisRequest) => {
        requests.push(req);
        return { fen: START_FEN, lines, depth: 12, bestmove, done: true, stopped: false } as AnalysisSnapshot;
      },
    },
  };
}

describe("chooseBotMove opening variety", () => {
  const lines = [line(1, 30, "e2e4"), line(2, 20, "d2d4"), line(3, -200, "a2a3")];

  it("picks at random among the near-best moves and never a clearly worse one", async () => {
    const opts = { varietyTopK: 3, varietyMaxLossCp: 40 };
    const a = fake(lines, "e2e4");
    expect((await chooseBotMove(a.engine, START_FEN, max, { ...opts, random: () => 0 }))?.uci).toBe("e2e4");
    expect((await chooseBotMove(a.engine, START_FEN, max, { ...opts, random: () => 0.99 }))?.uci).toBe("d2d4");
    expect(a.requests[0]).toMatchObject({ multiPv: 3 });
    for (let i = 0; i < 30; i++) expect((await chooseBotMove(a.engine, START_FEN, max, opts))?.uci).not.toBe("a2a3");
  });

  it("reads scores from the side to move's point of view (Black)", async () => {
    // Scores are White's point of view, so for Black the lowest is best: e7e5 (-30), c7c5 (-20), a7a6 (+200).
    const blackFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const black = [line(1, -30, "e7e5"), line(2, -20, "c7c5"), line(3, 200, "a7a6")];
    const f = fake(black, "e7e5");
    const picks = new Set<string>();
    for (let i = 0; i < 40; i++) picks.add((await chooseBotMove(f.engine, blackFen, max, { varietyTopK: 3, varietyMaxLossCp: 40 }))!.uci);
    expect(picks.has("a7a6")).toBe(false);
    expect([...picks].every((m) => m === "e7e5" || m === "c7c5")).toBe(true);
  });

  it("plays the best move without options (no extra lines requested)", async () => {
    const f = fake(lines, "e2e4");
    expect((await chooseBotMove(f.engine, START_FEN, max))?.uci).toBe("e2e4");
    expect(f.requests[0].multiPv).toBeUndefined();
  });

  it("does not gamble when a mate is on the board", async () => {
    const mate: EngineLine[] = [{ multipv: 1, depth: 20, score: { kind: "mate", value: 3 }, pv: ["e2e4"] }, line(2, 20, "d2d4")];
    const f = fake(mate, "e2e4");
    for (let i = 0; i < 20; i++) expect((await chooseBotMove(f.engine, START_FEN, max, { varietyTopK: 3, random: () => 0.99 }))?.uci).toBe("e2e4");
  });

  it("leaves the beginner levels to their own human-like choice", async () => {
    const f = fake(lines, "e2e4");
    await chooseBotMove(f.engine, START_FEN, beginner, { varietyTopK: 3 });
    expect(f.requests[0]).toMatchObject({ multiPv: beginner.humanize!.topK });
  });
});
