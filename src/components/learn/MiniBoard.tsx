"use client";

import { Chess } from "chess.js";
import { useSettings } from "@/components/providers/SettingsProvider";
import { cx } from "@/components/ui/primitives";
import { boardTheme } from "@/lib/appearance";
import { PieceImage, type PieceLetter } from "./PieceImage";


/**
 * A small, light board in the player's own piece set: enough to show an idea, with none of the weight of the real board.
 * Lit squares are filled and ringed so they stand out even at this size; `coords` writes the files and ranks.
 */
export function MiniBoard({ fen, glow = [], coords = false, flip = false, className }: { fen: string; glow?: readonly string[]; coords?: boolean; flip?: boolean; className?: string }) {
  // The player's own board colours, as on the main board.
  const { settings } = useSettings();
  const theme = boardTheme(settings.boardTheme);
  const board = new Chess(fen).board();
  // From Black's side the board is turned round: rows and files both reversed.
  const rows = flip ? board.slice().reverse().map((r) => r.slice().reverse()) : board;
  return (
    <div className={cx("grid aspect-square h-full max-h-[104px] grid-cols-8 grid-rows-8 overflow-hidden rounded-md border border-border", className)} aria-hidden>
      {rows.flatMap((row, r) =>
        row.map((sq, c) => {
          const name = flip ? `${"abcdefgh"[7 - c]}${r + 1}` : `${"abcdefgh"[c]}${8 - r}`;
          const lit = glow.includes(name);
          return (
            <span
              key={name}
              className={cx("relative grid place-items-center text-[10px] leading-none sm:text-xs", lit && "z-10 shadow-[inset_0_0_0_2px_var(--ink)]")}
              style={{ background: lit ? "var(--accent)" : (r + c) % 2 ? theme.dark : theme.light }}
            >
              {sq ? <PieceImage piece={sq.type.toUpperCase() as PieceLetter} color={sq.color} className="pointer-events-none size-[88%] select-none" /> : null}
              {coords && c === 0 ? <span className="absolute top-0 left-0.5 text-[6px] font-semibold text-black/60 sm:text-[7px]">{flip ? r + 1 : 8 - r}</span> : null}
              {coords && r === 7 ? <span className="absolute right-0.5 bottom-0 text-[6px] font-semibold text-black/60 sm:text-[7px]">{"abcdefgh"[flip ? 7 - c : c]}</span> : null}
            </span>
          );
        }),
      )}
    </div>
  );
}
