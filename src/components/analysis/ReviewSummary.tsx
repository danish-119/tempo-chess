"use client";

import { Clock, Flag } from "lucide-react";
import type { GameMetadata } from "@/lib/chess/types";
import { openingIdea } from "@/lib/openings";
import { type GamePhase, type GameReview, MOVE_CLASS_LABEL, MOVE_CLASS_ORDER } from "@/lib/review/types";
import { Term } from "@/components/ui/Term";
import { MoveClassIcon } from "./MoveClassBadge";

/** All categories except "forced", always shown (zeros included) for an at-a-glance comparison. */
const SHOWN = MOVE_CLASS_ORDER.filter((c) => c !== "forced");
const PHASES: GamePhase[] = ["opening", "middlegame", "endgame"];

/** Compact score card: accuracy per player and move-quality counts. */
export function ReviewScore({ review, metadata }: { review: GameReview; metadata: GameMetadata }) {
  const classes = SHOWN;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_auto] items-end gap-x-4 gap-y-1">
        <span className="text-xs text-ink-3">
          <Term id="accuracy">Accuracy</Term>
        </span>
        <span className="w-16 truncate text-right text-xs text-ink-3" title={metadata.white}>{metadata.white}</span>
        <span className="w-16 truncate text-right text-xs text-ink-3" title={metadata.black}>{metadata.black}</span>
        <span />
        <span className="w-16 rounded-md bg-[var(--eval-white)] py-1 text-center font-serif text-xl font-semibold text-[var(--eval-black)] ring-1 ring-border tabular">
          {review.white.accuracy?.toFixed(1) ?? "–"}
        </span>
        <span className="w-16 rounded-md bg-[var(--eval-black)] py-1 text-center font-serif text-xl font-semibold text-[var(--eval-white)] tabular">
          {review.black.accuracy?.toFixed(1) ?? "–"}
        </span>
        {metadata.chessComAccuracy ? (
          <>
            <span className="pt-1 text-[11px] text-ink-3">Chess.com&apos;s own figure</span>
            <span className="w-16 pt-1 text-center text-xs text-ink-3 tabular">{metadata.chessComAccuracy.white?.toFixed(1) ?? "–"}</span>
            <span className="w-16 pt-1 text-center text-xs text-ink-3 tabular">{metadata.chessComAccuracy.black?.toFixed(1) ?? "–"}</span>
          </>
        ) : null}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Move classifications for each player</caption>
        <tbody>
          {classes.map((c) => (
            <tr key={c}>
              <th scope="row" className="py-0.5 text-left font-normal">
                <span className="inline-flex items-center gap-2">
                  <MoveClassIcon classification={c} />
                  <Term id={c === "only" ? "only-move" : c}>{MOVE_CLASS_LABEL[c]}</Term>
                </span>
              </th>
              <td className={`w-16 text-right font-medium tabular ${review.white.counts[c] ? "" : "text-ink-3/60"}`}>{review.white.counts[c] ?? 0}</td>
              <td className={`w-16 text-right font-medium tabular ${review.black.counts[c] ? "" : "text-ink-3/60"}`}>{review.black.counts[c] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Optional extra statistics, shown collapsed. */
export function ReviewDetails({ review, onJump }: { review: GameReview; onJump: (ply: number) => void }) {
  const idea = review.opening ? openingIdea(review.opening.name) : null;
  const keyMoves = review.moves.filter((m) => m.keyMoment);
  const hasClock = review.moves.some((m) => m.clockSeconds !== undefined);
  return (
    <div className="space-y-4 pt-2 text-sm">
      {review.opening ? (
        <div>
          <p className="text-xs text-ink-3">Opening · {review.opening.eco}</p>
          <p className="font-medium">{review.opening.name}</p>
          {idea ? <p className="mt-1 text-ink-2">{idea}</p> : null}
        </div>
      ) : null}

      <table className="w-full">
        <caption className="mb-1 text-left text-xs text-ink-3">Accuracy by phase</caption>
        <tbody>
          {PHASES.map((p) => (
            <tr key={p}>
              <th scope="row" className="py-0.5 text-left font-normal capitalize">{p}</th>
              <td className="w-16 text-right tabular">{review.white.phaseAccuracy[p]?.toFixed(0) ?? "–"}</td>
              <td className="w-16 text-right tabular">{review.black.phaseAccuracy[p]?.toFixed(0) ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasClock ? (
        <p className="flex items-start gap-2 text-ink-2">
          <Clock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          <span>
            Errors under <Term id="time-pressure">time pressure</Term>: White {review.white.timePressureErrors}, Black {review.black.timePressureErrors}.
          </span>
        </p>
      ) : null}

      {keyMoves.length > 0 ? (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs text-ink-3">
            <Flag className="size-3.5" aria-hidden /> <Term id="key-moment">Key moments</Term>
          </p>
          <ul className="space-y-0.5">
            {keyMoves.map((m) => (
              <li key={m.ply}>
                <button type="button" onClick={() => onJump(m.ply)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-surface-2">
                  <MoveClassIcon classification={m.classification} />
                  <span className="font-mono">
                    {m.moveNumber}
                    {m.color === "w" ? "." : "…"} {m.san}
                  </span>
                  <span className="text-xs text-ink-3">{MOVE_CLASS_LABEL[m.classification]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] leading-relaxed text-ink-3">
        {review.engineName} · depth {review.settings.depth} · Tempo&apos;s own estimates. <a href="/about#method" target="_blank" rel="noopener" className="underline">Method</a>
      </p>
    </div>
  );
}
