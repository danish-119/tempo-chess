"use client";

import { useEffect, useState } from "react";
import { BookOpen, LogIn } from "lucide-react";
import { Button, Spinner, Tabs } from "@/components/ui/primitives";
import { useLichessAuth } from "@/hooks/useLichessAuth";
import { dropLichessAuth, startLichessLogin } from "@/lib/lichess/auth";
import { type ExplorerDb, ExplorerError, type ExplorerResult, fetchExplorer, shares, totalGames } from "@/lib/lichess/explorer";

const DB_KEY = "tempo:explorer:db";

type State = { key: string; status: "loading" } | { key: string; status: "ready"; result: ExplorerResult } | { key: string; status: "error"; message: string };

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

function ResultBar({ r }: { r: { white: number; draws: number; black: number } }) {
  const [w, d, b] = shares(r);
  return (
    <div className="flex h-4 w-full overflow-hidden rounded text-[10px] font-semibold leading-4 tabular" aria-label={`White ${w}%, draw ${d}%, Black ${b}%`}>
      <span className="bg-[var(--eval-white)] text-center text-[var(--eval-black)]" style={{ width: `${w}%` }}>{w >= 12 ? `${w}%` : ""}</span>
      <span className="bg-ink-3/50 text-center text-bg" style={{ width: `${d}%` }}>{d >= 12 ? `${d}%` : ""}</span>
      <span className="bg-[var(--eval-black)] text-center text-[var(--eval-white)]" style={{ width: `${b}%` }}>{b >= 12 ? `${b}%` : ""}</span>
    </div>
  );
}

function loadDb(): ExplorerDb {
  try {
    return localStorage.getItem(DB_KEY) === "lichess" ? "lichess" : "masters";
  } catch {
    return "masters";
  }
}

/** Opening explorer: what masters / Lichess players played from this position. */
export function ExplorerPanel({ fen, onPlay }: { fen: string; onPlay: (uci: string) => void }) {
  const auth = useLichessAuth();
  const [db, setDbState] = useState<ExplorerDb>(loadDb);
  const [state, setState] = useState<State | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${db}|${fen}`;

  const setDb = (d: ExplorerDb) => {
    setDbState(d);
    try {
      localStorage.setItem(DB_KEY, d);
    } catch {
      /* not remembered */
    }
  };

  useEffect(() => {
    if (!auth) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setState({ key, status: "loading" });
      fetchExplorer(db, fen, auth.token, controller.signal).then(
        (result) => setState({ key, status: "ready", result }),
        (err: unknown) => {
          if (controller.signal.aborted) return;
          if (err instanceof ExplorerError && err.code === "UNAUTHORIZED") dropLichessAuth();
          setState({ key, status: "error", message: err instanceof Error ? err.message : "Explorer unavailable." });
        },
      );
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [auth, db, fen, key, attempt]);

  const connect = () => void startLichessLogin(window.location.pathname + window.location.search);

  if (!auth) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4 text-center">
        <BookOpen className="mx-auto size-8 text-accent" aria-hidden />
        <p className="font-semibold">Opening explorer</p>
        <p className="text-sm text-ink-2">See what masters and Lichess players chose here, and how those games ended. Lichess requires a free account for the explorer.</p>
        <Button variant="primary" onClick={connect}>
          <LogIn className="size-4" aria-hidden /> Connect Lichess
        </Button>
      </div>
    );
  }

  const current = state?.key === key ? state : null;

  return (
    <div className="space-y-3">
      <Tabs<ExplorerDb>
        label="Explorer database"
        value={db}
        onChange={setDb}
        tabs={[
          { id: "masters", label: "Masters" },
          { id: "lichess", label: "Lichess 1600+" },
        ]}
      />
      {!current || current.status === "loading" ? (
        <Spinner label="Loading…" />
      ) : current.status === "error" ? (
        <div className="space-y-2">
          <p className="text-sm text-ink-3">{current.message}</p>
          <Button size="sm" onClick={() => setAttempt((a) => a + 1)}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {current.result.opening ? (
            <p className="text-sm">
              <span className="font-mono text-xs text-ink-3">{current.result.opening.eco}</span> <span className="font-semibold">{current.result.opening.name}</span>
            </p>
          ) : null}
          {current.result.moves.length === 0 ? (
            <p className="text-sm text-ink-3">No games reached this position in the {db === "masters" ? "masters" : "Lichess"} database.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="py-1 font-medium">Move</th>
                  <th className="py-1 text-right font-medium">Games</th>
                  <th className="w-1/2 py-1 pl-3 font-medium">Results</th>
                </tr>
              </thead>
              <tbody>
                {current.result.moves.map((m) => {
                  const n = totalGames(m);
                  const pct = Math.round((n / Math.max(1, totalGames(current.result))) * 100);
                  return (
                    <tr key={m.uci} className="cursor-pointer border-t border-border hover:bg-surface-2" onClick={() => onPlay(m.uci)}>
                      <td className="py-1.5">
                        <button type="button" className="font-mono font-semibold" onClick={(e) => { e.stopPropagation(); onPlay(m.uci); }}>
                          {m.san}
                        </button>
                      </td>
                      <td className="py-1.5 text-right tabular">
                        {compact.format(n)} <span className="text-xs text-ink-3">{pct}%</span>
                      </td>
                      <td className="py-1.5 pl-3">
                        <ResultBar r={m} />
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border text-ink-2">
                  <td className="py-1.5 text-xs">Σ</td>
                  <td className="py-1.5 text-right tabular">{compact.format(totalGames(current.result))}</td>
                  <td className="py-1.5 pl-3">
                    <ResultBar r={current.result} />
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </>
      )}
      <p className="text-xs text-ink-3">
        Data: Lichess opening explorer{auth.username ? ` · connected as ${auth.username}` : ""}
      </p>
    </div>
  );
}
