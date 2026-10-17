import { type Score, toWhitePov } from "./score";
import { type UciInfo, parseUciLine } from "./uci";
import type { Color } from "@/lib/chess/types";

/** Minimal surface of a Worker so the engine can be driven by a fake in tests. */
export interface WorkerLike {
  postMessage(message: string): void;
  terminate(): void;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: ErrorEvent) => void) | null;
}

export type WorkerFactory = () => WorkerLike;

export type EngineFlavor = "multi" | "single";

export interface EngineLine {
  multipv: number;
  depth: number;
  seldepth?: number;
  /** Score from White's point of view. */
  score: Score;
  bound?: "lower" | "upper";
  /** Principal variation in UCI notation. */
  pv: string[];
}

export interface AnalysisSnapshot {
  fen: string;
  lines: EngineLine[];
  depth: number;
  nodes?: number;
  nps?: number;
  timeMs?: number;
  bestmove: string | null;
  done: boolean;
  /** True if this search was superseded or stopped before its limit. */
  stopped: boolean;
}

export interface AnalysisRequest {
  fen: string;
  depth?: number;
  movetimeMs?: number;
  multiPv?: number;
  /** Restrict the search to these moves (UCI) — used for "only move" checks. */
  searchMoves?: string[];
  /**
   * Strength-limiting options (Play vs Stockfish). Options not given are
   * reset to full strength, so analysis is never accidentally weakened.
   */
  strength?: { skillLevel?: number; elo?: number };
}

/** Full-strength values for the options `strength` can change. */
const STRENGTH_DEFAULTS = { "Skill Level": "20", UCI_LimitStrength: "false", UCI_Elo: "3190" } as const;
type StrengthOption = keyof typeof STRENGTH_DEFAULTS;

export class EngineError extends Error {
  readonly code: "INIT_TIMEOUT" | "WORKER_ERROR" | "UNSUPPORTED" | "TERMINATED";
  constructor(code: EngineError["code"], message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

interface Job {
  request: AnalysisRequest;
  sideToMove: Color;
  onUpdate?: (s: AnalysisSnapshot) => void;
  resolve: (s: AnalysisSnapshot) => void;
  reject: (e: Error) => void;
  snapshot: AnalysisSnapshot;
  lines: Map<number, EngineLine>;
  stopRequested: boolean;
}

export interface EngineInfo {
  name: string;
  flavor: EngineFlavor;
  threads: number;
}

const INIT_TIMEOUT_MS = 30_000;
export const MAX_MULTIPV = 5;
export const MAX_MOVETIME_MS = 60_000;
export const MAX_DEPTH = 40;

/**
 * A UCI client for Stockfish running inside a Web Worker.
 *
 * Only one search runs at a time. Calling `analyze` while a search is active
 * stops it (the superseded promise resolves with `stopped: true`) and the
 * newest request runs once the engine reports `bestmove` for the old one.
 */
export class StockfishEngine {
  private worker: WorkerLike | null;
  private active: Job | null = null;
  private pending: Job | null = null;
  private lineWaiters: { match: (msg: string) => boolean; resolve: () => void }[] = [];
  private currentMultiPv = 1;
  private appliedOptions: Record<StrengthOption, string> = { ...STRENGTH_DEFAULTS };
  private dead: EngineError | null = null;
  private errorListeners = new Set<(e: EngineError) => void>();
  readonly info: EngineInfo;

  private constructor(worker: WorkerLike, info: EngineInfo) {
    this.worker = worker;
    this.info = info;
    worker.onmessage = (ev: MessageEvent) => this.handleLine(String(ev.data));
    worker.onerror = (ev: ErrorEvent) => {
      ev.preventDefault?.();
      this.fail(new EngineError("WORKER_ERROR", ev.message || "The engine worker crashed."));
    };
  }

  /** Spawn a worker, complete the UCI handshake and configure options. */
  static async create(
    factory: WorkerFactory,
    opts: { flavor: EngineFlavor; threads?: number; hashMb?: number; timeoutMs?: number },
  ): Promise<StockfishEngine> {
    let worker: WorkerLike;
    try {
      worker = factory();
    } catch (err) {
      throw new EngineError("UNSUPPORTED", err instanceof Error ? err.message : "Could not start the engine worker.");
    }
    const threads = opts.flavor === "multi" ? Math.max(1, opts.threads ?? 1) : 1;
    const engine = new StockfishEngine(worker, { name: "Stockfish", flavor: opts.flavor, threads });
    const timeoutMs = opts.timeoutMs ?? INIT_TIMEOUT_MS;

    const initError = new Promise<never>((_, reject) => {
      engine.errorListeners.add(reject);
    });
    const handshake = (async () => {
      let name = "Stockfish";
      const idListener = (line: string) => {
        const msg = parseUciLine(line);
        if (msg.type === "id" && msg.name) name = msg.name;
        return msg.type === "uciok";
      };
      const uciok = engine.waitFor(idListener);
      engine.send("uci");
      await uciok;
      if (threads > 1) engine.send(`setoption name Threads value ${threads}`);
      engine.send(`setoption name Hash value ${opts.hashMb ?? 32}`);
      engine.send("setoption name MultiPV value 1");
      const ready = engine.waitFor((l) => l === "readyok");
      engine.send("isready");
      await ready;
      (engine.info as { name: string }).name = name;
    })();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new EngineError("INIT_TIMEOUT", "The engine did not respond in time. Your browser may not support WebAssembly workers.")),
        timeoutMs,
      );
    });
    try {
      await Promise.race([handshake, timeout, initError]);
      return engine;
    } catch (err) {
      engine.terminate();
      throw err instanceof EngineError ? err : new EngineError("WORKER_ERROR", String(err));
    } finally {
      clearTimeout(timer);
      engine.errorListeners.clear();
    }
  }

  get isAlive(): boolean {
    return this.dead === null;
  }

  get isSearching(): boolean {
    return this.active !== null;
  }

  onError(listener: (e: EngineError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Analyse a position. Resolves when the search finishes or is superseded.
   * Rejects only if the engine itself fails.
   */
  analyze(request: AnalysisRequest, onUpdate?: (s: AnalysisSnapshot) => void): Promise<AnalysisSnapshot> {
    if (this.dead) return Promise.reject(this.dead);
    const sideToMove = (request.fen.split(" ")[1] === "b" ? "b" : "w") as Color;
    return new Promise<AnalysisSnapshot>((resolve, reject) => {
      const job: Job = {
        request,
        sideToMove,
        onUpdate,
        resolve,
        reject,
        lines: new Map(),
        stopRequested: false,
        snapshot: { fen: request.fen, lines: [], depth: 0, bestmove: null, done: false, stopped: false },
      };
      if (this.pending) this.finish(this.pending, true);
      if (this.active) {
        this.pending = job;
        this.stopActive();
      } else {
        this.start(job);
      }
    });
  }

  /** Stop the running search (and drop any queued one). */
  stop(): void {
    if (this.pending) {
      this.finish(this.pending, true);
      this.pending = null;
    }
    this.stopActive();
  }

  terminate(): void {
    if (!this.worker) return;
    try {
      this.worker.postMessage("quit");
    } catch {
      /* worker may already be gone */
    }
    this.worker.terminate();
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker = null;
    const err = new EngineError("TERMINATED", "The engine was shut down.");
    if (!this.dead) this.dead = err;
    if (this.pending) this.finish(this.pending, true);
    if (this.active) this.finish(this.active, true);
    this.pending = null;
    this.active = null;
  }

  private stopActive(): void {
    if (this.active && !this.active.stopRequested) {
      this.active.stopRequested = true;
      this.send("stop");
    }
  }

  private start(job: Job): void {
    this.active = job;
    const { request } = job;
    const multiPv = Math.min(MAX_MULTIPV, Math.max(1, request.multiPv ?? 1));
    if (multiPv !== this.currentMultiPv) {
      this.send(`setoption name MultiPV value ${multiPv}`);
      this.currentMultiPv = multiPv;
    }
    const wanted: Record<StrengthOption, string> = { ...STRENGTH_DEFAULTS };
    if (request.strength?.skillLevel !== undefined) {
      wanted["Skill Level"] = String(Math.round(Math.min(20, Math.max(0, request.strength.skillLevel))));
    }
    if (request.strength?.elo !== undefined) {
      wanted.UCI_LimitStrength = "true";
      wanted.UCI_Elo = String(Math.round(Math.min(3190, Math.max(1320, request.strength.elo))));
    }
    for (const key of Object.keys(wanted) as StrengthOption[]) {
      if (this.appliedOptions[key] !== wanted[key]) {
        this.send(`setoption name ${key} value ${wanted[key]}`);
        this.appliedOptions[key] = wanted[key];
      }
    }
    this.send(`position fen ${request.fen}`);
    const parts = ["go"];
    if (request.depth) parts.push("depth", String(Math.min(MAX_DEPTH, request.depth)));
    if (request.movetimeMs) parts.push("movetime", String(Math.min(MAX_MOVETIME_MS, request.movetimeMs)));
    if (!request.depth && !request.movetimeMs) parts.push("depth", "18");
    if (request.searchMoves && request.searchMoves.length > 0) parts.push("searchmoves", ...request.searchMoves);
    this.send(parts.join(" "));
  }

  private finish(job: Job, stopped: boolean): void {
    const lines = [...job.lines.values()].sort((a, b) => a.multipv - b.multipv);
    job.snapshot = { ...job.snapshot, lines, done: true, stopped: stopped || job.stopRequested };
    job.resolve(job.snapshot);
  }

  private handleLine(line: string): void {
    for (const waiter of [...this.lineWaiters]) {
      if (waiter.match(line)) {
        this.lineWaiters = this.lineWaiters.filter((w) => w !== waiter);
        waiter.resolve();
      }
    }
    const job = this.active;
    if (!job) return;
    const msg = parseUciLine(line);
    if (msg.type === "info") {
      this.applyInfo(job, msg.info);
    } else if (msg.type === "bestmove") {
      job.snapshot = { ...job.snapshot, bestmove: msg.bestmove };
      this.active = null;
      this.finish(job, false);
      const next = this.pending;
      this.pending = null;
      if (next && !this.dead) this.start(next);
    }
  }

  private applyInfo(job: Job, info: UciInfo): void {
    // Ignore lines without a PV/score (e.g. currmove updates) and bound-only
    // scores, which are not reliable evaluations of the position.
    if (info.score && info.pv && info.pv.length > 0 && info.depth !== undefined && !info.bound) {
      const multipv = info.multipv ?? 1;
      job.lines.set(multipv, {
        multipv,
        depth: info.depth,
        seldepth: info.seldepth,
        score: toWhitePov(info.score, job.sideToMove),
        pv: info.pv,
      });
    }
    const lines = [...job.lines.values()].sort((a, b) => a.multipv - b.multipv);
    job.snapshot = {
      ...job.snapshot,
      lines,
      depth: Math.max(job.snapshot.depth, lines[0]?.depth ?? 0),
      nodes: info.nodes ?? job.snapshot.nodes,
      nps: info.nps ?? job.snapshot.nps,
      timeMs: info.timeMs ?? job.snapshot.timeMs,
    };
    if (info.score && info.pv) job.onUpdate?.(job.snapshot);
  }

  private waitFor(match: (line: string) => boolean): Promise<void> {
    return new Promise((resolve) => {
      this.lineWaiters.push({ match, resolve });
    });
  }

  private send(cmd: string): void {
    if (!this.worker) return;
    this.worker.postMessage(cmd);
  }

  private fail(err: EngineError): void {
    if (this.dead) return;
    this.dead = err;
    for (const l of this.errorListeners) l(err);
    const jobs = [this.active, this.pending].filter((j): j is Job => j !== null);
    this.active = null;
    this.pending = null;
    for (const j of jobs) j.reject(err);
    this.worker?.terminate();
    this.worker = null;
  }
}
