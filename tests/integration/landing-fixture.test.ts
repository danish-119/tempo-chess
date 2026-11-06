// @vitest-environment node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { OPERA_GAME } from "@/content/opera-game";
import { parseSingleGame } from "@/lib/chess/pgn";
import type { ImportedGame } from "@/lib/chess/types";
import { StockfishEngine } from "@/lib/engine/engine";
import { REVIEW_PRESETS, runReview } from "@/lib/review/review";
import { MOVE_CLASS_LABEL, type GameReview } from "@/lib/review/types";
import { ENGINE_PATH, ProcessWorker } from "../helpers/processWorker";

const FIXTURE = join(process.cwd(), "src", "content", "opera-review.json");

type Pos = { cp: number } | { mate: number };

function toFixture(game: ImportedGame, review: GameReview) {
  return {
    game: { title: OPERA_GAME.title, white: OPERA_GAME.white, black: OPERA_GAME.black, where: OPERA_GAME.where },
    engine: review.engineName,
    preset: review.settings.preset,
    depth: review.settings.depth,
    /** Evaluation of every position (start position first), from White's point of view. */
    positions: review.positions.map((p): Pos => (p.score.kind === "cp" ? { cp: p.score.value } : { mate: p.score.value })),
    moves: review.moves.map((m, i) => ({
      ply: m.ply,
      san: m.san,
      uci: m.uci,
      fen: game.moves[i].fenAfter,
      cls: m.classification,
      text: m.explanation.text,
      best: m.bestMoveSan,
    })),
    accuracy: { white: review.white.accuracy, black: review.black.accuracy },
  };
}

describe.skipIf(!existsSync(ENGINE_PATH))("landing page fixture", () => {
  if (process.env.GEN_LANDING === "1") {
    it("regenerates src/content/opera-review.json with the real engine", async () => {
      const engine = await StockfishEngine.create(() => new ProcessWorker(), { flavor: "single", hashMb: 32 });
      try {
        const game = parseSingleGame(OPERA_GAME.pgn);
        const review = await runReview(game, engine, REVIEW_PRESETS.standard, { engineName: engine.info.name, openingTable: null });
        writeFileSync(FIXTURE, `${JSON.stringify(toFixture(game, review), null, 2)}\n`);
      } finally {
        engine.terminate();
      }
    }, 900_000);
  }

  it("is a legal, consistent record of the Opera Game with real engine output", () => {
    const fx = JSON.parse(readFileSync(FIXTURE, "utf8")) as ReturnType<typeof toFixture>;
    const game = parseSingleGame(OPERA_GAME.pgn);
    expect(fx.moves).toHaveLength(game.moves.length);
    expect(fx.positions).toHaveLength(game.moves.length + 1);
    expect(fx.engine).toMatch(/Stockfish/);

    const chess = new Chess();
    fx.moves.forEach((m, i) => {
      const played = chess.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] });
      expect(played.san).toBe(m.san);
      expect(m.fen).toBe(chess.fen());
      expect(m.cls in MOVE_CLASS_LABEL).toBe(true);
      expect(m.text.length).toBeGreaterThan(3);
      expect(m.ply).toBe(i + 1);
    });
    expect(chess.isCheckmate()).toBe(true);
    for (const side of [fx.accuracy.white, fx.accuracy.black]) {
      expect(side).toBeGreaterThan(0);
      expect(side).toBeLessThanOrEqual(100);
    }
  });
});
