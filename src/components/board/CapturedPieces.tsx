"use client";

import { useSettings } from "@/components/providers/SettingsProvider";
import { pieceUrl } from "@/lib/appearance";
import { capturedPieces, describePieces } from "@/lib/chess/captured";
import { START_FEN } from "@/lib/chess/types";
import type { PieceSymbol } from "@/lib/chess/types";

/**
 * The pieces `side` has captured, plus "+N" when `side` is ahead in material. It reads the position, so it
 * follows the board when you step back through a game. A fixed height keeps the layout from jumping at the
 * first capture.
 */
export function CapturedPieces({ fen, side, baseFen = START_FEN }: { fen: string; side: "w" | "b"; baseFen?: string }) {
  const { settings } = useSettings();
  const set = settings.pieceSet === "classic" ? "cburnett" : settings.pieceSet;
  const cap = capturedPieces(fen, baseFen);
  const taken = side === "w" ? cap.byWhite : cap.byBlack;
  const lead = side === "w" ? cap.balance : -cap.balance;
  const color = side === "w" ? "b" : "w"; // the captured pieces belong to the opponent
  const sideName = side === "w" ? "White" : "Black";

  // Group equal pieces so they overlap slightly, like a small stack.
  const groups: { piece: PieceSymbol; count: number }[] = [];
  for (const p of taken) {
    const last = groups[groups.length - 1];
    if (last && last.piece === p) last.count++;
    else groups.push({ piece: p, count: 1 });
  }

  const label =
    taken.length === 0 && lead <= 0
      ? `${sideName} has captured nothing yet.`
      : `Captured by ${sideName}: ${taken.length ? describePieces(taken) : "nothing"}.${lead > 0 ? ` ${sideName} is ahead by ${lead} ${lead === 1 ? "point" : "points"}.` : ""}`;

  return (
    <span role="img" aria-label={label} className="mt-0.5 flex min-h-5 items-center gap-1.5">
      {groups.map(({ piece, count }) => (
        <span key={piece} className="flex items-center" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={pieceUrl(set, `${color}${piece.toUpperCase()}`)} alt="" draggable={false} className={`size-5 ${i > 0 ? "-ml-2.5" : ""}`} />
          ))}
        </span>
      ))}
      {lead > 0 ? (
        <span className="text-xs font-semibold tabular text-ink-2" aria-hidden>
          +{lead}
        </span>
      ) : null}
    </span>
  );
}
