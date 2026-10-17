import { describe, expect, it } from "vitest";
import { EngineError, StockfishEngine, type WorkerLike } from "@/lib/engine/engine";

/**
 * Scriptable fake worker: records commands and lets the test emit UCI lines.
 * Used to test the protocol state machine deterministically; the real engine
 * is covered by tests/integration/engine.test.ts.
 */
class FakeWorker implements WorkerLike {
  sent: string[] = [];
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  terminated = false;
  autoHandshake = true;

  postMessage(cmd: string) {
    this.sent.push(cmd);
    if (!this.autoHandshake) return;
    if (cmd === "uci") queueMicrotask(() => (this.emit("id name FakeFish"), this.emit("uciok")));
    if (cmd === "isready") queueMicrotask(() => this.emit("readyok"));
    if (cmd === "stop") queueMicrotask(() => this.emit("bestmove e2e4"));
  }
  terminate() {
    this.terminated = true;
  }
  emit(line: string) {
    this.onmessage?.({ data: line } as MessageEvent);
  }
}

async function create() {
  const w = new FakeWorker();
  const engine = await StockfishEngine.create(() => w, { flavor: "single" });
  return { w, engine };
}

const FEN_B = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("StockfishEngine protocol", () => {
  it("completes the UCI handshake", async () => {
    const { w, engine } = await create();
    expect(w.sent.slice(0, 1)).toEqual(["uci"]);
    expect(w.sent).toContain("isready");
    expect(engine.info.name).toBe("FakeFish");
  });

  it("streams info, normalises Black's scores to White POV and resolves on bestmove", async () => {
    const { w, engine } = await create();
    const updates: number[] = [];
    const p = engine.analyze({ fen: FEN_B, depth: 10, multiPv: 2 }, (s) => updates.push(s.depth));
    expect(w.sent).toContain(`position fen ${FEN_B}`);
    expect(w.sent).toContain("setoption name MultiPV value 2");
    expect(w.sent[w.sent.length - 1]).toBe("go depth 10");
    w.emit("info depth 5 seldepth 7 multipv 1 score cp 30 nodes 100 nps 1000 pv e7e5 g1f3");
    w.emit("info depth 5 multipv 2 score mate 3 pv d8h4");
    w.emit("info depth 6 multipv 1 score cp 40 upperbound pv e7e5"); // bound: ignored
    w.emit("bestmove e7e5 ponder g1f3");
    const snap = await p;
    expect(snap.bestmove).toBe("e7e5");
    expect(snap.lines[0].score).toEqual({ kind: "cp", value: -30 });
    expect(snap.lines[1].score).toEqual({ kind: "mate", value: -3 });
    expect(snap.done).toBe(true);
    expect(snap.stopped).toBe(false);
    expect(updates.length).toBeGreaterThan(0);
  });

  it("supersedes an obsolete search with a new position", async () => {
    const { w, engine } = await create();
    const first = engine.analyze({ fen: FEN_B, depth: 30 });
    const second = engine.analyze({ fen: "8/8/8/8/8/8/k7/K6Q w - - 0 1", depth: 5 });
    const s1 = await first; // resolved after the auto-emitted bestmove for "stop"
    expect(s1.stopped).toBe(true);
    expect(w.sent.filter((c) => c === "stop")).toHaveLength(1);
    expect(w.sent[w.sent.length - 1]).toBe("go depth 5");
    w.emit("bestmove h1h8");
    expect((await second).bestmove).toBe("h1h8");
  });

  it("stop() ends the search", async () => {
    const { engine } = await create();
    const p = engine.analyze({ fen: FEN_B, depth: 30 });
    engine.stop();
    expect((await p).stopped).toBe(true);
  });

  it("applies and resets strength options", async () => {
    const { w, engine } = await create();
    const p = engine.analyze({ fen: FEN_B, movetimeMs: 100, strength: { elo: 1500 } });
    expect(w.sent).toContain("setoption name UCI_LimitStrength value true");
    expect(w.sent).toContain("setoption name UCI_Elo value 1500");
    w.emit("bestmove e7e5");
    await p;
    const q = engine.analyze({ fen: FEN_B, depth: 5 });
    expect(w.sent).toContain("setoption name UCI_LimitStrength value false");
    w.emit("bestmove e7e5");
    await q;
  });

  it("surfaces worker crashes as EngineError and rejects pending work", async () => {
    const { w, engine } = await create();
    const p = engine.analyze({ fen: FEN_B, depth: 30 });
    w.onerror?.({ message: "boom", preventDefault() {} } as ErrorEvent);
    await expect(p).rejects.toBeInstanceOf(EngineError);
    expect(engine.isAlive).toBe(false);
    await expect(engine.analyze({ fen: FEN_B })).rejects.toMatchObject({ code: "WORKER_ERROR" });
  });

  it("times out when the engine never answers", async () => {
    const w = new FakeWorker();
    w.autoHandshake = false;
    await expect(StockfishEngine.create(() => w, { flavor: "single", timeoutMs: 50 })).rejects.toMatchObject({ code: "INIT_TIMEOUT" });
    expect(w.terminated).toBe(true);
  });

  it("reports a worker that cannot be constructed", async () => {
    await expect(
      StockfishEngine.create(() => {
        throw new Error("no workers");
      }, { flavor: "single" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });
});
