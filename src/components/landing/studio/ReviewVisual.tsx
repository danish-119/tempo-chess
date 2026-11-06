import { MoveClassBadge, moveClassColor } from "@/components/analysis/MoveClassBadge";
import { KEY_PLIES, OPERA, OPERA_PLIES, operaLabel, operaScore } from "@/content/opera-review";
import { evalBarFraction } from "@/lib/engine/score";

const W = 640;
const H = 230;
const PAD = 14;

const x = (ply: number) => PAD + (ply / OPERA_PLIES) * (W - PAD * 2);

/** White's share of the advantage at `ply`. A checkmate position has no evaluation, so it counts for whoever just moved. */
function whiteShare(ply: number): number {
  const score = operaScore(ply);
  if (score.kind === "mate" && score.value === 0) return ply % 2 === 1 ? 1 : 0;
  return evalBarFraction(score);
}
const y = (ply: number) => PAD + (1 - whiteShare(ply)) * (H - PAD * 2);

const POINTS = Array.from({ length: OPERA_PLIES + 1 }, (_, i) => `${x(i).toFixed(1)},${y(i).toFixed(1)}`);
const LINE = `M${POINTS.join(" L")}`;
const AREA = `${LINE} L${x(OPERA_PLIES).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;

function Accuracy({ label, value, t }: { label: string; value: number; t: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow !text-[11px]">{label}</span>
        <span className="display text-2xl tabular text-ink">{t > 0 ? (value * t).toFixed(1) : "—"}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value * t}%` }} />
      </div>
    </div>
  );
}

/**
 * The evaluation graph, drawn up to `ply`, with the memorable moments of the game landing on it as they are passed.
 * Every grade and sentence is from Tempo's own review of the game.
 */
export function ReviewVisual({ ply, accuracyT }: { ply: number; accuracyT: number }) {
  const move = ply > 0 ? OPERA.moves[ply - 1] : null;
  const keyNow = [...KEY_PLIES].reverse().find((p) => p <= ply);
  const shown = move && (move.cls === "brilliant" || move.cls === "mistake" || move.cls === "blunder") ? move : keyNow ? OPERA.moves[keyNow - 1] : null;

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-3">
      <div className="rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow)] sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Evaluation graph of the Opera Game. White's advantage grows steadily after the opening and the game ends in a back-rank checkmate."
        >
          <defs>
            <clipPath id="review-drawn">
              <rect x="0" y="0" width={x(ply)} height={H} />
            </clipPath>
            <linearGradient id="review-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="var(--border)" strokeDasharray="4 6" />
          <path d={LINE} fill="none" stroke="var(--border)" strokeWidth="2" />
          <g clipPath="url(#review-drawn)">
            <path d={AREA} fill="url(#review-fill)" />
            <path d={LINE} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          {KEY_PLIES.map((p) => (
            <circle
              key={p}
              cx={x(p)}
              cy={y(p)}
              r={p <= ply ? 8 : 0}
              fill={moveClassColor(OPERA.moves[p - 1].cls)}
              stroke="var(--surface)"
              strokeWidth="3"
              style={{ transition: "r 0.35s cubic-bezier(0.2,0.8,0.2,1.4)" }}
            />
          ))}
          {ply > 0 ? (
            <g>
              <line x1={x(ply)} x2={x(ply)} y1={PAD} y2={H - PAD} stroke="var(--ink-3)" strokeOpacity="0.45" />
              <circle cx={x(ply)} cy={y(ply)} r="5" fill="var(--ink)" stroke="var(--surface)" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
        <p className="eyebrow mt-2 flex justify-between !text-[11px]" aria-hidden>
          <span>Black ahead</span>
          <span className="normal-case">{operaLabel(ply)}</span>
          <span>White ahead</span>
        </p>
      </div>

      <div className="min-h-[7.25rem] rounded-2xl border border-border bg-surface p-4 sm:min-h-[8rem] sm:p-5" aria-live="off">
        {shown ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-base font-semibold tabular">{operaLabel(shown.ply)}</span>
              <MoveClassBadge classification={shown.cls} />
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{shown.text}</p>
          </>
        ) : (
          <p className="text-[15px] leading-relaxed text-ink-3">Keep scrolling: the game replays, and the memorable moments land here with their grade.</p>
        )}
      </div>

      <div className="hidden gap-6 sm:grid sm:grid-cols-2">
        <Accuracy label="White · accuracy" value={OPERA.accuracy.white} t={accuracyT} />
        <Accuracy label="Black · accuracy" value={OPERA.accuracy.black} t={accuracyT} />
      </div>
    </div>
  );
}
