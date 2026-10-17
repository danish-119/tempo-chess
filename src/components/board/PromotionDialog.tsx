"use client";

import { useEffect, useRef } from "react";
import { defaultPieces } from "react-chessboard";
import { X } from "lucide-react";
import { pieceUrl } from "@/lib/appearance";

const CHOICES = [
  { id: "q", label: "Queen", code: "Q" },
  { id: "n", label: "Knight", code: "N" },
  { id: "r", label: "Rook", code: "R" },
  { id: "b", label: "Bishop", code: "B" },
] as const;

const FILES = "abcdefgh";

/**
 * Promotion picker drawn over the board: a column of the four pieces drops
 * from the promotion square (like most chess sites), using the current
 * piece set. Esc, the × button or a click outside cancels.
 */
export function PromotionDialog({
  color,
  square,
  orientation,
  pieceSet,
  onSelect,
  onCancel,
}: {
  color: "w" | "b";
  square: string;
  orientation: "white" | "black";
  pieceSet: string;
  onSelect: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 8 - rank : rank - 1;
  const fromTop = row === 0;

  const renderPiece = (code: string) => {
    const key = `${color}${code}`;
    if (pieceSet === "classic") {
      const Piece = defaultPieces[key];
      return Piece ? <Piece /> : null;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pieceUrl(pieceSet, key)} alt="" className="size-full" draggable={false} />;
  };

  return (
    <div className="absolute inset-0 z-20 bg-black/35" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a piece to promote to"
        className="absolute flex overflow-hidden rounded-md bg-surface shadow-2xl ring-1 ring-black/10"
        style={{
          left: `${col * 12.5}%`,
          width: "12.5%",
          flexDirection: fromTop ? "column" : "column-reverse",
          ...(fromTop ? { top: 0 } : { bottom: 0 }),
        }}
      >
        {CHOICES.map((p, i) => (
          <button
            key={p.id}
            ref={i === 0 ? firstRef : undefined}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-label={`Promote to ${p.label}`}
            title={p.label}
            className="aspect-square w-full p-[8%] transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft"
          >
            {renderPiece(p.code)}
          </button>
        ))}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel promotion"
          className="flex h-[40%] min-h-6 w-full items-center justify-center bg-surface-2 text-ink-3 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
