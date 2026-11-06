import { Chess, type Move, type Square } from "chess.js";
import { PIECE_VALUE, countMaterial } from "@/lib/chess/material";
import type { Color, PieceSymbol } from "@/lib/chess/types";

/**
 * Board facts about one played move. Everything here is read straight from
 * the position with chess.js (no engine, no guessing), so the explainer can
 * describe good moves with real content: what was captured, whether it was
 * defended, what the move attacks, and so on.
 */
export type Phase = "opening" | "middlegame" | "endgame";
export type MateKind = "back-rank" | "smothered" | "other";

export interface MoveFacts {
  move: Move;
  mover: Color;
  opp: Color;
  phase: Phase;
  fullmove: number;
  inCheckBefore: boolean;
  capture: { piece: PieceSymbol; square: string; free: boolean } | null;
  givesCheck: boolean;
  mate: MateKind | null;
  stalemates: boolean;
  drawsGame: boolean;
  castle: "king-side" | "queen-side" | null;
  promotion: PieceSymbol | null;
  /** The moved piece was in danger before the move and is safe afterwards. */
  escapes: boolean;
  /** Enemy pieces newly attacked by the moved piece that are loose or worth more than it. */
  attacks: { piece: PieceSymbol; square: string }[];
  develops: boolean;
  centralPawn: boolean;
  /** File letter when a rook moves onto a file with no pawns at all. */
  openFile: string | null;
  passedPawnPush: boolean;
  kingActivation: boolean;
}

export function gamePhase(fen: string): Phase {
  const m = countMaterial(fen);
  const queens = m.pieces.w.q + m.pieces.b.q;
  if (m.minorMajorPieces <= 6 || (queens === 0 && m.minorMajorPieces <= 8)) return "endgame";
  const fullmove = Number(fen.split(" ")[5]) || 1;
  return fullmove <= 12 && m.minorMajorPieces >= 12 ? "opening" : "middlegame";
}

const FILES = "abcdefgh";
const opposite = (c: Color): Color => (c === "w" ? "b" : "w");

function minAttackerValue(chess: Chess, square: Square, by: Color): number {
  const values = chess.attackers(square, by).map((s) => PIECE_VALUE[chess.get(s)?.type ?? "p"]);
  return values.length ? Math.min(...values) : Infinity;
}

/** Is the piece on `square` attacked and either undefended or attacked by something cheaper? */
function isEnPrise(chess: Chess, square: Square, color: Color): boolean {
  const piece = chess.get(square);
  if (!piece || piece.type === "k") return false;
  const lowest = minAttackerValue(chess, square, opposite(color));
  if (lowest === Infinity) return false;
  return chess.attackers(square, color).length === 0 || lowest < PIECE_VALUE[piece.type];
}

function isPassed(chess: Chess, square: Square, color: Color): boolean {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.type !== "p" || cell.color === color) continue;
      const f = FILES.indexOf(cell.square[0]);
      const r = Number(cell.square[1]);
      if (Math.abs(f - file) <= 1 && (color === "w" ? r > rank : r < rank)) return false;
    }
  }
  return true;
}

function centreDistance(square: string): number {
  return Math.max(Math.abs(FILES.indexOf(square[0]) - 3.5), Math.abs(Number(square[1]) - 1 - 3.5));
}

function mateKind(after: Chess, move: Move, victim: Color): MateKind {
  const kingSq = after.findPiece({ type: "k", color: victim })[0];
  if (!kingSq) return "other";
  const backRank = victim === "w" ? "1" : "8";
  if (kingSq.endsWith(backRank) && (move.piece === "r" || move.piece === "q") && move.to.endsWith(backRank)) return "back-rank";
  if (move.piece === "n") {
    const f = FILES.indexOf(kingSq[0]);
    const r = Number(kingSq[1]);
    let boxed = true;
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const nf = f + df;
        const nr = r + dr;
        if (nf < 0 || nf > 7 || nr < 1 || nr > 8) continue;
        const occupant = after.get(`${FILES[nf]}${nr}` as Square);
        if (!occupant || occupant.color !== victim) boxed = false;
      }
    }
    if (boxed) return "smothered";
  }
  return "other";
}

/** Facts about `uci` played from `fenBefore`, or null if the move is not legal there. */
export function moveFacts(fenBefore: string, uci: string): MoveFacts | null {
  const before = new Chess(fenBefore);
  let move: Move;
  try {
    move = before.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
  const after = new Chess(before.fen());
  const reference = new Chess(fenBefore);
  const mover = move.color;
  const opp = opposite(mover);
  const phase = gamePhase(fenBefore);
  const fullmove = Number(fenBefore.split(" ")[5]) || 1;
  const from = move.from;
  const to = move.to;

  const capture = move.captured
    ? { piece: move.captured, square: to, free: after.attackers(to, opp).length === 0 }
    : null;

  const castle = move.isKingsideCastle() ? "king-side" : move.isQueensideCastle() ? "queen-side" : null;

  const movedValue = PIECE_VALUE[move.piece];
  const escapes =
    !capture &&
    move.piece !== "p" &&
    move.piece !== "k" &&
    isEnPrise(reference, from, mover) &&
    !isEnPrise(after, to, mover);

  const attacks: { piece: PieceSymbol; square: string }[] = [];
  if (!after.isGameOver()) {
    for (const row of after.board()) {
      for (const cell of row) {
        if (!cell || cell.color !== opp || cell.type === "k" || cell.type === "p") continue;
        if (!after.attackers(cell.square, mover).includes(to)) continue;
        if (reference.attackers(cell.square, mover).includes(from)) continue; // already attacked before
        const loose = after.attackers(cell.square, opp).length === 0;
        if (loose || PIECE_VALUE[cell.type] > movedValue) attacks.push({ piece: cell.type, square: cell.square });
      }
    }
  }

  const homeRank = mover === "w" ? "1" : "8";
  const develops = phase !== "endgame" && fullmove <= 12 && (move.piece === "n" || move.piece === "b") && from.endsWith(homeRank) && !capture;
  const centralPawn = move.piece === "p" && fullmove <= 10 && !capture && ["d4", "e4", "d5", "e5"].includes(to);

  let openFile: string | null = null;
  if (move.piece === "r" && from[0] !== to[0]) {
    const file = to[0];
    let pawnsOnFile = false;
    for (const row of after.board()) {
      for (const cell of row) if (cell && cell.type === "p" && cell.square[0] === file) pawnsOnFile = true;
    }
    if (!pawnsOnFile) openFile = file;
  }

  const passedPawnPush = phase === "endgame" && move.piece === "p" && !capture && isPassed(after, to, mover);
  const kingActivation = phase === "endgame" && move.piece === "k" && !castle && centreDistance(to) < centreDistance(from);

  const checkmate = after.isCheckmate();
  return {
    move,
    mover,
    opp,
    phase,
    fullmove,
    inCheckBefore: reference.inCheck(),
    capture,
    givesCheck: after.inCheck(),
    mate: checkmate ? mateKind(after, move, opp) : null,
    stalemates: after.isStalemate(),
    drawsGame: after.isDraw() && !after.isStalemate(),
    castle,
    promotion: move.promotion ?? null,
    escapes,
    attacks: attacks.slice(0, 2),
    develops,
    centralPawn,
    openFile,
    passedPawnPush,
    kingActivation,
  };
}
