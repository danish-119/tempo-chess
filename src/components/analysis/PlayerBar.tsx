import type { GameMetadata, PlyRecord } from "@/lib/chess/types";
import { formatClock } from "@/lib/review/time";
import { cx } from "@/components/ui/primitives";

/** Player name, rating and (when available) the clock at the current ply. */
export function PlayerBar({
  color,
  metadata,
  moves,
  ply,
  toMove,
  liveClock,
}: {
  color: "w" | "b";
  metadata: GameMetadata;
  moves: PlyRecord[];
  ply: number;
  toMove: boolean;
  /** Seconds to show instead of the recorded clock (ticking during real-time replay). */
  liveClock?: number;
}) {
  const name = color === "w" ? metadata.white : metadata.black;
  const elo = color === "w" ? metadata.whiteElo : metadata.blackElo;
  let clock: number | undefined = liveClock;
  for (let i = Math.min(ply, moves.length) - 1; clock === undefined && i >= 0; i--) {
    if (moves[i].color === color && moves[i].clockSeconds !== undefined) {
      clock = moves[i].clockSeconds;
      break;
    }
  }
  const won = (metadata.result === "1-0" && color === "w") || (metadata.result === "0-1" && color === "b");
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="inline-block size-3.5 shrink-0 rounded-sm border border-border"
          style={{ background: color === "w" ? "var(--eval-white)" : "var(--eval-black)" }}
          aria-hidden
        />
        <span className="truncate text-sm font-semibold" title={name}>
          {name}
        </span>
        {elo ? <span className="text-xs text-ink-3 tabular">({elo})</span> : null}
        {won ? <span className="rounded bg-good-soft px-1.5 text-[11px] font-medium text-good">won</span> : null}
      </div>
      {clock !== undefined ? (
        <span
          className={cx(
            "rounded-md px-2 py-0.5 font-mono text-sm tabular",
            toMove ? "bg-ink text-bg" : "bg-surface-2 text-ink-2",
          )}
          aria-label={`${name}'s clock: ${formatClock(clock)}`}
        >
          {formatClock(clock)}
        </span>
      ) : null}
    </div>
  );
}
