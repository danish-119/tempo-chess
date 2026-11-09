"use client";

import { Flame, Hourglass, Infinity as InfinityIcon, Timer, Zap } from "lucide-react";
import { defaultPieces } from "react-chessboard";
import { useSettings } from "@/components/providers/SettingsProvider";
import { cx } from "@/components/ui/primitives";
import { pieceUrl } from "@/lib/appearance";
import { TIME_CONTROLS } from "@/lib/clock";

/** Icons and colours (CSS colour values) for the time-control tiles. */
export const TC_ICON = { none: InfinityIcon, bullet: Zap, blitz: Flame, rapid: Timer, classical: Hourglass } as const;
export const TC_COLOR = {
  none: "var(--ink-3)",
  bullet: "var(--c-blunder)",
  blitz: "var(--c-mistake)",
  rapid: "var(--c-best)",
  classical: "var(--c-only)",
} as const;

/** King image in the chosen piece set (used on the "Play as" tiles). */
export function KingIcon({ color, set }: { color: "w" | "b"; set: string }) {
  const code = `${color}K` as keyof typeof defaultPieces;
  if (set === "classic") {
    const Piece = defaultPieces[code];
    return Piece ? <Piece /> : null;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={pieceUrl(set, code)} alt="" className="size-full" draggable={false} />;
}

const tile = (selected: boolean) =>
  cx(
    "flex cursor-pointer flex-col items-center gap-1 rounded-xl border text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)]",
    selected ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
  );

export type ColorChoice = "w" | "random" | "b";

/** "Play as": White, Random or Black, each shown as a king in the player's piece set. Used by every Play mode. */
export function ColorPicker({ value, onChange, name = "color" }: { value: ColorChoice; onChange: (c: ColorChoice) => void; name?: string }) {
  const { settings } = useSettings();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Play as</legend>
      <div className="grid grid-cols-3 gap-2">
        {(["w", "random", "b"] as const).map((c) => (
          <label key={c} className={cx(tile(value === c), "p-2 text-sm")}>
            <input type="radio" name={name} className="sr-only" checked={value === c} onChange={() => onChange(c)} />
            <span className="relative block size-12" aria-hidden>
              {c === "random" ? (
                <>
                  <span className="absolute inset-0 overflow-hidden" style={{ clipPath: "inset(0 50% 0 0)" }}>
                    <KingIcon color="w" set={settings.pieceSet} />
                  </span>
                  <span className="absolute inset-0 overflow-hidden" style={{ clipPath: "inset(0 0 0 50%)" }}>
                    <KingIcon color="b" set={settings.pieceSet} />
                  </span>
                </>
              ) : (
                <KingIcon color={c} set={settings.pieceSet} />
              )}
            </span>
            <span className="font-medium">{c === "w" ? "White" : c === "b" ? "Black" : "Random"}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "Time control": a coloured icon, the time and its speed (bullet, blitz, …) per tile. Used by every Play mode. */
export function TimeControlPicker({ value, onChange, name = "tc" }: { value: string; onChange: (id: string) => void; name?: string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Time control</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {TIME_CONTROLS.map((t) => {
          const Icon = TC_ICON[t.kind];
          return (
            <label key={t.id} className={cx(tile(value === t.id), "px-1 py-2")}>
              <input type="radio" name={name} className="sr-only" checked={value === t.id} onChange={() => onChange(t.id)} />
              <Icon className="size-5" style={{ color: TC_COLOR[t.kind] }} aria-hidden />
              <span className="text-xs font-semibold">{t.label}</span>
              <span className="text-[10px] capitalize text-ink-3">{t.kind === "none" ? "untimed" : t.kind}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
