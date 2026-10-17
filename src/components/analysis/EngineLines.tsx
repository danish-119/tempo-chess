"use client";

import { Cpu, Pause, Play, RotateCcw, Square } from "lucide-react";
import { formatSanLine, playLine } from "@/lib/chess/line";
import type { AnalysisSnapshot } from "@/lib/engine/engine";
import { formatScore } from "@/lib/engine/score";
import type { EngineStatus } from "@/hooks/useEngine";
import { Alert, Button, Spinner, cx } from "@/components/ui/primitives";
import { Term } from "@/components/ui/Term";

interface Props {
  fen: string;
  status: EngineStatus;
  snapshot: AnalysisSnapshot | null;
  running: boolean;
  paused: boolean;
  enabled: boolean;
  busyReason?: string | null;
  targetDepth: number;
  onToggle: () => void;
  onRetry: () => void;
  /** Explore line `lineIndex` up to move `moveIndex` (1-based). */
  onExplore: (ucis: string[], moveIndex: number) => void;
  /** Lines come from the saved review (instant) rather than a live search. */
  fromReview?: boolean;
  deeper?: boolean;
  onDeeper?: () => void;
}

function formatNodes(n?: number): string {
  if (!n) return "–";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(n);
}

export function EngineLines({ fen, status, snapshot, running, paused, enabled, busyReason, targetDepth, onToggle, onRetry, onExplore, fromReview, deeper, onDeeper }: Props) {
  if (status.state === "error") {
    return (
      <Alert
        tone="error"
        title="Engine unavailable"
        action={
          <Button size="sm" onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden /> Retry
          </Button>
        }
      >
        {status.message}
      </Alert>
    );
  }

  const depth = snapshot?.depth ?? 0;
  const progress = Math.min(1, depth / targetDepth);
  // "Stockfish 19 Lite WASM Multithreaded" → "Stockfish 19" (build details are noise here).
  const engineName = status.state === "ready" ? status.engine.info.name.replace(/\s+(Lite|WASM|NNUE|Multithreaded|Single).*$/i, "") : "Stockfish";
  const engineLabel =
    status.state === "ready"
      ? `${engineName} · ${status.engine.info.flavor === "multi" ? `${status.engine.info.threads} threads` : "1 thread"}`
      : "Stockfish";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-ink-3">
          <Cpu className="size-4 shrink-0" aria-hidden />
          <span className="truncate" title={status.state === "ready" ? status.engine.info.name : undefined}>{engineLabel}</span>
        </div>
        {onDeeper ? (
          <Button size="sm" variant={deeper ? "secondary" : "primary"} onClick={onDeeper} disabled={!!busyReason} className="shrink-0 whitespace-nowrap">
            {deeper ? <Square className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            {deeper ? "Back to review" : "Analyze deeper"}
          </Button>
        ) : (
          <Button size="sm" variant={enabled ? "secondary" : "primary"} onClick={onToggle} disabled={!!busyReason} aria-pressed={enabled} className="shrink-0 whitespace-nowrap">
            {enabled ? <Square className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            {enabled ? "Stop" : "Analyze"}
          </Button>
        )}
      </div>

      {busyReason ? <p className="text-xs text-ink-3">{busyReason}</p> : null}
      {status.state === "loading" ? <Spinner label="Loading Stockfish…" /> : null}
      {paused ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-3">
          <Pause className="size-3.5" aria-hidden /> Paused while the tab is hidden.
        </p>
      ) : null}

      {enabled && (status.state === "ready" || fromReview) ? (
        <>
          <div className="flex items-center gap-3 text-xs text-ink-2 tabular" aria-live="off">
            <span>
              <Term id="depth">Depth</Term> {depth}
              {snapshot?.lines[0]?.seldepth ? `/${snapshot.lines[0].seldepth}` : ""}
            </span>
            <span>Nodes {formatNodes(snapshot?.nodes)}</span>
            <span>{snapshot?.nps ? `${formatNodes(snapshot.nps)}/s` : ""}</span>
            <span className="ml-auto">{fromReview ? "from review" : running ? "searching…" : snapshot?.done ? "complete" : ""}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <ul className="space-y-1" aria-label="Engine lines">
            {(snapshot?.lines ?? []).map((line) => {
              const steps = playLine(fen, line.pv, 14);
              const sans = steps.map((s) => s.move.san);
              const text = formatSanLine(fen, sans);
              const tokens = text.split(" ");
              let moveIdx = 0;
              return (
                <li key={line.multipv} className="flex items-start gap-2 rounded-md border border-border bg-surface-2/40 px-2 py-1.5">
                  <span
                    className={cx(
                      "mt-0.5 min-w-[3.25rem] rounded px-1.5 py-0.5 text-center font-mono text-xs font-bold tabular",
                      (line.score.kind === "mate" ? line.score.value > 0 : line.score.value >= 0)
                        ? "bg-[var(--eval-white)] text-[var(--eval-black)] border border-border"
                        : "bg-[var(--eval-black)] text-[var(--eval-white)]",
                    )}
                    title="Evaluation from White's point of view"
                  >
                    {formatScore(line.score)}
                  </span>
                  <p className="min-w-0 flex-1 font-mono text-[13px] leading-relaxed text-ink-2">
                    {tokens.map((tok, i) => {
                      const isMove = !/^\d+(\.|…)$/.test(tok);
                      if (!isMove) return <span key={i} className="text-ink-3">{tok} </span>;
                      moveIdx++;
                      const idx = moveIdx;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onExplore(line.pv.slice(0, steps.length), idx)}
                          className={cx("rounded px-0.5 hover:bg-accent-soft hover:text-ink", idx === 1 && "font-semibold text-ink")}
                        >
                          {tok}
                        </button>
                      );
                    })}
                  </p>
                </li>
              );
            })}
            {enabled && (!snapshot || snapshot.lines.length === 0) && !paused ? (
              <li className="text-sm text-ink-3">{running ? "Thinking…" : "No legal moves in this position."}</li>
            ) : null}
          </ul>
        </>
      ) : null}
    </div>
  );
}
