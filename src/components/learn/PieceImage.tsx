"use client";

import { useSettings } from "@/components/providers/SettingsProvider";
import { cx } from "@/components/ui/primitives";
import { pieceUrl } from "@/lib/appearance";

export type PieceLetter = "K" | "Q" | "R" | "B" | "N" | "P";

const UNICODE: Record<"w" | "b", Record<PieceLetter, string>> = {
  w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

/** A piece drawn in the player's chosen set (the classic set is drawn with text). */
export function PieceImage({ piece, color = "w", className }: { piece: PieceLetter; color?: "w" | "b"; className?: string }) {
  const { settings } = useSettings();
  if (settings.pieceSet === "classic") return <span className={cx("leading-none", color === "w" ? "text-white" : "text-black", className)}>{UNICODE[color][piece]}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={pieceUrl(settings.pieceSet, `${color}${piece}`)} alt="" className={className} draggable={false} />;
}
