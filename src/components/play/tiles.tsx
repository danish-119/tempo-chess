import { Flame, Hourglass, Infinity as InfinityIcon, Timer, Zap } from "lucide-react";
import { defaultPieces } from "react-chessboard";
import { pieceUrl } from "@/lib/appearance";

/** Icons and colours for the time-control tiles (shared by Play and Play-a-friend). */
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
