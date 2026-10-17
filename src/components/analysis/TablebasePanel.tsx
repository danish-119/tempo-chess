"use client";

import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { SectionTitle, Spinner, cx } from "@/components/ui/primitives";
import { type Outcome, type TablebaseResult, distanceLabel, fetchTablebase, moveOutcome, tablebaseApplies, verdict } from "@/lib/tablebase";

const OUTCOME_STYLE: Record<Outcome, string> = {
  win: "bg-good-soft text-good",
  draw: "bg-surface-2 text-ink-2",
  loss: "bg-bad-soft text-bad",
  unknown: "bg-surface-2 text-ink-3",
};
const OUTCOME_LABEL: Record<Outcome, string> = { win: "Win", draw: "Draw", loss: "Loss", unknown: "?" };

type State = { fen: string; status: "loading" } | { fen: string; status: "ready"; result: TablebaseResult } | { fen: string; status: "error"; message: string };

/** Exact endgame results from the Lichess 7-piece tablebase (shown only when ≤ 7 pieces). */
export function TablebasePanel({ fen, onPlay }: { fen: string; onPlay: (uci: string) => void }) {
  const applies = tablebaseApplies(fen);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!applies) return;
    const controller = new AbortController();
    // Short delay so stepping quickly through moves doesn't fire a request per move.
    const t = setTimeout(() => {
      setState({ fen, status: "loading" });
      fetchTablebase(fen, controller.signal).then(
        (result) => setState({ fen, status: "ready", result }),
        (err: unknown) => {
          if (!controller.signal.aborted) setState({ fen, status: "error", message: err instanceof Error ? err.message : "Tablebase unavailable." });
        },
      );
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [fen, applies]);

  if (!applies) return null;
  const current = state?.fen === fen ? state : null;
  const turn = fen.split(" ")[1] === "b" ? "b" : "w";

  return (
    <section className="space-y-2" aria-live="polite">
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Database className="size-3.5" aria-hidden /> Endgame tablebase
        </span>
      </SectionTitle>
      {!current || current.status === "loading" ? (
        <Spinner label="Looking up…" />
      ) : current.status === "error" ? (
        <p className="text-sm text-ink-3">{current.message}</p>
      ) : (
        <>
          <p className="font-semibold">{verdict(current.result, turn)}</p>
          {current.result.moves.length ? (
            <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {current.result.moves.map((m) => {
                const o = moveOutcome(m);
                const dist = m.checkmate ? "Checkmate" : m.stalemate ? "Stalemate" : distanceLabel(m.dtm, m.dtz);
                return (
                  <li key={m.uci}>
                    <button type="button" onClick={() => onPlay(m.uci)} className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm hover:bg-surface-2">
                      <span className="w-16 font-mono font-semibold">{m.san}</span>
                      <span className={cx("rounded px-1.5 py-0.5 text-xs font-semibold", OUTCOME_STYLE[o])}>{OUTCOME_LABEL[o]}</span>
                      {dist ? <span className="ml-auto text-xs text-ink-3 tabular">{dist}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
