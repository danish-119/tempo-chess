// @vitest-environment node
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { StockfishEngine } from "@/lib/engine/engine";
import { ENGINE_PATH as ENGINE, ProcessWorker } from "../helpers/processWorker";
import { parseSingleGame } from "@/lib/chess/pgn";
import { runReview, REVIEW_PRESETS } from "@/lib/review/review";

/**
 * Integration tests against the REAL Stockfish.js 19 lite single-threaded
 * build (the same file served to browsers). Node runs it as a CLI over
 * stdio; this adapter exposes it through the WorkerLike interface so the
 * exact production UCI client is exercised.
 */
describe.skipIf(!existsSync(ENGINE))("real Stockfish engine", () => {
  let engine: StockfishEngine;

  beforeAll(async () => {
    engine = await StockfishEngine.create(() => new ProcessWorker(), { flavor: "single", hashMb: 16 });
  }, 60_000);

  afterAll(() => engine?.terminate());

  it("completes the UCI handshake and identifies itself", () => {
    expect(engine.info.name).toMatch(/Stockfish/);
  });

  it("returns a legal best move for the start position", async () => {
    const snap = await engine.analyze({ fen: new Chess().fen(), depth: 10 });
    expect(snap.bestmove).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    const legal = new Chess().moves({ verbose: true }).map((m) => `${m.from}${m.to}`);
    expect(legal).toContain(snap.bestmove);
    expect(snap.lines[0].depth).toBeGreaterThanOrEqual(10);
    // Opening position is roughly balanced.
    expect(snap.lines[0].score.kind).toBe("cp");
    expect(Math.abs(snap.lines[0].score.value)).toBeLessThan(100);
  });

  it("finds a mate in 1 and reports it as a mate score (White POV)", async () => {
    // Back-rank mate: Rd8#
    const snap = await engine.analyze({ fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", depth: 8 });
    expect(snap.bestmove).toBe("d1d8");
    expect(snap.lines[0].score).toEqual({ kind: "mate", value: 1 });
  });

  it("normalises a Black-to-move mate to White's perspective", async () => {
    const snap = await engine.analyze({ fen: "3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1", depth: 8 });
    expect(snap.bestmove).toBe("d8d1");
    expect(snap.lines[0].score).toEqual({ kind: "mate", value: -1 });
  });

  it("returns multiple principal variations", async () => {
    const snap = await engine.analyze({ fen: new Chess().fen(), depth: 8, multiPv: 3 });
    expect(snap.lines).toHaveLength(3);
    expect(new Set(snap.lines.map((l) => l.pv[0])).size).toBe(3);
  });

  it("can be stopped mid-search", async () => {
    const p = engine.analyze({ fen: new Chess().fen(), depth: 40 });
    setTimeout(() => engine.stop(), 200);
    const snap = await p;
    expect(snap.stopped).toBe(true);
    expect(snap.bestmove).not.toBeNull();
  });

  it("replaces an obsolete search when the position changes", async () => {
    const first = engine.analyze({ fen: new Chess().fen(), depth: 40 });
    const second = engine.analyze({ fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", depth: 6 });
    expect((await first).stopped).toBe(true);
    expect((await second).bestmove).toBe("d1d8");
  });

  it("plays legal moves at the weakest bot setting (skill 0, depth 1)", async () => {
    const fen = new Chess().fen();
    const snap = await engine.analyze({ fen, depth: 1, movetimeMs: 150, strength: { skillLevel: 0 } });
    const legal = new Chess(fen).moves({ verbose: true }).map((m) => `${m.from}${m.to}`);
    expect(legal).toContain(snap.bestmove);
    // Full strength is restored for the next search.
    const strong = await engine.analyze({ fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", depth: 8 });
    expect(strong.bestmove).toBe("d1d8");
  });

  it("reviews a short game end-to-end with real evaluations", async () => {
    const game = parseSingleGame("1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0");
    const review = await runReview(game, engine, { ...REVIEW_PRESETS.quick, depth: 10, movetimeMs: 2000 }, { engineName: engine.info.name, openingTable: null });
    expect(review.moves).toHaveLength(7);
    const nf6 = review.moves[5];
    expect(nf6.classification).toBe("blunder");
    expect(nf6.explanation.motifs).toContain("allows-mate");
    expect(review.moves[6].classification).toBe("best");
    expect(review.black.accuracy!).toBeLessThan(review.white.accuracy!);
  }, 60_000);
});
