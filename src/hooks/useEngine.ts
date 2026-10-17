"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { getEngine, resetEngine } from "@/lib/engine/client";
import { EngineError, type StockfishEngine } from "@/lib/engine/engine";

export type EngineStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; engine: StockfishEngine }
  | { state: "error"; message: string; code: EngineError["code"] | "UNKNOWN" };

/** Lazily loads the shared Stockfish engine and tracks its health. */
export function useEngine() {
  const { settings, ready: settingsReady } = useSettings();
  const [status, setStatus] = useState<EngineStatus>({ state: "idle" });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (): Promise<StockfishEngine | null> => {
    if (!settingsReady) return null;
    setStatus((s) => (s.state === "ready" ? s : { state: "loading" }));
    try {
      const engine = await getEngine({ forceSingle: settings.engineMode === "single", threads: settings.threads });
      if (!mounted.current) return engine;
      setStatus({ state: "ready", engine });
      engine.onError((e) => mounted.current && setStatus({ state: "error", message: e.message, code: e.code }));
      return engine;
    } catch (err) {
      const e = err instanceof EngineError ? err : null;
      if (mounted.current) {
        setStatus({
          state: "error",
          message: e?.message ?? "The engine could not be started.",
          code: e?.code ?? "UNKNOWN",
        });
      }
      return null;
    }
  }, [settingsReady, settings.engineMode, settings.threads]);

  const retry = useCallback(async () => {
    await resetEngine();
    return load();
  }, [load]);

  return { status, load, retry };
}
