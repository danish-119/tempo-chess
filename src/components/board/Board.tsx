"use client";

import { Chess, type Square } from "chess.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Arrow, Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from "react-chessboard";
import type { MoveClass } from "@/lib/review/types";
import { BoardBadge } from "./BoardBadge";
import { boardTheme } from "@/lib/appearance";
import { usePieceRenderers } from "./pieces";
import { useSettings } from "@/components/providers/SettingsProvider";
import { PromotionDialog } from "./PromotionDialog";

export interface BoardArrow {
  from: string;
  to: string;
  kind: "best" | "alt" | "played" | "threat";
}

export interface BoardProps {
  fen: string;
  orientation: "white" | "black";
  lastMove?: { from: string; to: string } | null;
  arrows?: BoardArrow[];
  /** Extra square highlights, e.g. puzzle feedback. */
  highlights?: Record<string, "good" | "bad" | "hint">;
  /** When false the board is view-only. */
  interactive?: boolean;
  /** Restrict which colour may move (Play mode). */
  movableColor?: "w" | "b" | "both";
  /** Return true if the move was accepted. */
  onMove?: (uci: string) => boolean;
  id?: string;
  ariaLabel?: string;
  /** Move-quality badge drawn on a square (the destination of the move shown). */
  badge?: { square: string; classification: MoveClass } | null;
}

const ARROW_COLOR: Record<BoardArrow["kind"], string> = {
  best: "var(--arrow-best)",
  alt: "var(--arrow-alt)",
  played: "var(--arrow-played)",
  threat: "var(--arrow-threat)",
};

const HIGHLIGHT: Record<"good" | "bad" | "hint", React.CSSProperties> = {
  good: { boxShadow: "inset 0 0 0 4px var(--good)" },
  bad: { boxShadow: "inset 0 0 0 4px var(--bad)" },
  hint: { boxShadow: "inset 0 0 0 4px var(--info)" },
};

function describePosition(chess: Chess): string {
  const side = chess.turn() === "w" ? "White" : "Black";
  if (chess.isCheckmate()) return `Checkmate. ${side} is mated.`;
  if (chess.isStalemate()) return "Stalemate.";
  return `${side} to move${chess.inCheck() ? ", in check" : ""}.`;
}

export function Board({
  fen,
  orientation,
  lastMove,
  arrows = [],
  highlights,
  interactive = true,
  movableColor = "both",
  onMove,
  id = "tempo-board",
  ariaLabel = "Chess board",
  badge,
}: BoardProps) {
  const { settings } = useSettings();
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: "w" | "b" } | null>(null);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  // Clear selection whenever the position changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(null);
  }, [fen]);

  const canMoveColor = useCallback(
    (color: "w" | "b") => interactive && !!onMove && (movableColor === "both" || movableColor === color) && chess.turn() === color,
    [interactive, onMove, movableColor, chess],
  );

  const legalTargets = useMemo(() => {
    if (!selected) return [];
    return chess.moves({ square: selected, verbose: true }).map((m) => m.to);
  }, [selected, chess]);

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      if (!onMove) return false;
      const piece = chess.get(from as Square);
      if (!piece || !canMoveColor(piece.color)) return false;
      const legal = chess.moves({ square: from as Square, verbose: true }).filter((m) => m.to === to);
      if (legal.length === 0) return false;
      if (legal.some((m) => m.promotion)) {
        setPendingPromotion({ from, to, color: piece.color });
        return false;
      }
      return onMove(`${from}${to}`);
    },
    [chess, onMove, canMoveColor],
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      setSelected(null);
      if (!targetSquare || sourceSquare === targetSquare) return false;
      return tryMove(sourceSquare, targetSquare);
    },
    [tryMove],
  );

  const onSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (!interactive) return;
      const piece = chess.get(square as Square);
      if (selected) {
        if (square === selected) {
          setSelected(null);
          return;
        }
        if (legalTargets.includes(square as Square)) {
          tryMove(selected, square);
          setSelected(null);
          return;
        }
      }
      if (piece && canMoveColor(piece.color)) setSelected(square as Square);
      else setSelected(null);
    },
    [interactive, chess, selected, legalTargets, tryMove, canMoveColor],
  );

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: "var(--sq-last)" };
      styles[lastMove.to] = { backgroundColor: "var(--sq-last)" };
    }
    if (chess.inCheck()) {
      const king = chess.findPiece({ type: "k", color: chess.turn() })[0];
      if (king) styles[king] = { ...styles[king], backgroundImage: "var(--sq-check)" };
    }
    if (selected) styles[selected] = { ...styles[selected], backgroundColor: "var(--sq-select)" };
    if (settings.showLegalMoves) {
      for (const t of legalTargets) {
        const occupied = Boolean(chess.get(t));
        styles[t] = {
          ...styles[t],
          backgroundImage: occupied
            ? "radial-gradient(circle, transparent 58%, rgba(29,27,24,0.28) 60%)"
            : "radial-gradient(circle, rgba(29,27,24,0.28) 18%, transparent 20%)",
        };
      }
    }
    if (highlights) {
      for (const [sq, kind] of Object.entries(highlights)) styles[sq] = { ...styles[sq], ...HIGHLIGHT[kind] };
    }
    return styles;
  }, [lastMove, chess, selected, legalTargets, highlights, settings.showLegalMoves]);

  const boardArrows: Arrow[] = useMemo(
    () =>
      settings.showArrows
        ? arrows.filter((a) => a.from !== a.to).map((a) => ({ startSquare: a.from, endSquare: a.to, color: ARROW_COLOR[a.kind] }))
        : [],
    [arrows, settings.showArrows],
  );

  const theme = boardTheme(settings.boardTheme);
  const pieces = usePieceRenderers(settings.pieceSet);

  // Custom square content: same styling the library applies by default,
  // plus the classification badge on the relevant square.
  const squareRenderer = useCallback(
    ({ square, children }: { square: string; children?: React.ReactNode }) => (
      <div style={{ width: "100%", height: "100%", position: "relative", ...squareStyles[square] }}>
        {children}
        {badge && badge.square === square ? <BoardBadge classification={badge.classification} /> : null}
      </div>
    ),
    [squareStyles, badge],
  );

  return (
    <div className="relative w-full select-none" role="group" aria-label={`${ariaLabel}. ${describePosition(chess)}`}>
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          showNotation: settings.showCoordinates,
          showAnimations: settings.animations,
          animationDurationInMs: 160,
          allowDragging: interactive && !!onMove,
          allowDrawingArrows: true,
          arrows: boardArrows,
          clearArrowsOnPositionChange: true,
          canDragPiece: ({ piece }) => canMoveColor(piece.pieceType[0] === "w" ? "w" : "b"),
          onPieceDrop,
          onSquareClick,
          squareStyles,
          squareRenderer,
          ...(pieces ? { pieces } : {}),
          darkSquareStyle: { backgroundColor: theme.dark },
          lightSquareStyle: { backgroundColor: theme.light },
          darkSquareNotationStyle: { color: theme.light, fontWeight: 600 },
          lightSquareNotationStyle: { color: theme.dark, fontWeight: 600 },
          boardStyle: { borderRadius: "6px", overflow: "hidden", boxShadow: "var(--shadow)" },
        }}
      />
      {pendingPromotion ? (
        <PromotionDialog
          color={pendingPromotion.color}
          square={pendingPromotion.to}
          orientation={orientation}
          pieceSet={settings.pieceSet}
          onCancel={() => setPendingPromotion(null)}
          onSelect={(piece) => {
            const { from, to } = pendingPromotion;
            setPendingPromotion(null);
            onMove?.(`${from}${to}${piece}`);
          }}
        />
      ) : null}
    </div>
  );
}
