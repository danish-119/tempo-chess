import { type EngineFlavor, EngineError, StockfishEngine, type WorkerLike } from "./engine";

/**
 * Browser-side engine loader.
 *
 * - The multi-threaded lite build is used only when the page is
 *   cross-origin isolated (SharedArrayBuffer available). Otherwise, or if it
 *   fails to start, the single-threaded lite build is used.
 * - The engine is created lazily on first use and shared app-wide.
 */
export const ENGINE_BASE = "/engine";
export const ENGINE_FILES: Record<EngineFlavor, string> = {
  multi: `${ENGINE_BASE}/stockfish-19-lite.js`,
  single: `${ENGINE_BASE}/stockfish-19-lite-single.js`,
};

export interface EngineSupport {
  wasm: boolean;
  workers: boolean;
  threads: boolean;
}

export function detectSupport(): EngineSupport {
  const g = globalThis as typeof globalThis & { crossOriginIsolated?: boolean };
  return {
    wasm: typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function",
    workers: typeof Worker !== "undefined",
    threads: Boolean(g.crossOriginIsolated) && typeof SharedArrayBuffer !== "undefined",
  };
}

const isMobile = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

/**
 * Use as much of the device as is sensible: every logical core but one (kept
 * free for the UI), up to 8 — or 2 on phones/tablets to limit heat and battery.
 */
export function recommendedThreads(): number {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(isMobile() ? 2 : 8, cores - 1));
}

/** Transposition-table size scaled to device memory (navigator.deviceMemory is in GB, Chromium only). */
export function recommendedHashMb(): number {
  const mem = typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;
  if (isMobile()) return 32;
  if (mem !== undefined && mem >= 8) return 256;
  if (mem !== undefined && mem >= 4) return 128;
  return 64;
}

let enginePromise: Promise<StockfishEngine> | null = null;

async function create(flavor: EngineFlavor, threads: number): Promise<StockfishEngine> {
  return StockfishEngine.create(() => new Worker(ENGINE_FILES[flavor]) as unknown as WorkerLike, {
    flavor,
    threads,
    hashMb: flavor === "multi" ? recommendedHashMb() : Math.min(64, recommendedHashMb()),
  });
}

export interface EngineLoadOptions {
  /** Force the single-threaded build (e.g. from Settings or on low power). */
  forceSingle?: boolean;
  threads?: number;
}

export function getEngine(opts: EngineLoadOptions = {}): Promise<StockfishEngine> {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const support = detectSupport();
    if (!support.wasm || !support.workers) {
      throw new EngineError("UNSUPPORTED", "This browser does not support WebAssembly workers, which Stockfish needs.");
    }
    if (support.threads && !opts.forceSingle) {
      try {
        return await create("multi", opts.threads && opts.threads > 0 ? opts.threads : recommendedThreads());
      } catch (err) {
        console.warn("[tempo] Multi-threaded engine failed, falling back to single-threaded.", err);
      }
    }
    return create("single", 1);
  })();
  enginePromise.then(
    (engine) => engine.onError(() => (enginePromise = null)),
    () => (enginePromise = null),
  );
  return enginePromise;
}

/** Terminate the shared engine (e.g. to retry after an error or apply settings). */
export async function resetEngine(): Promise<void> {
  const p = enginePromise;
  enginePromise = null;
  if (!p) return;
  try {
    (await p).terminate();
  } catch {
    /* already failed */
  }
}
