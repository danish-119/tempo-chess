import { Chess } from "chess.js";
import { applyUci } from "./line";
import type { ImportedGame, PlyRecord } from "./types";

/**
 * Single source of truth for where the user is in a game.
 *
 * The imported mainline is immutable. Exploring a different move creates a
 * *variation* that branches from a mainline ply; the variation lives only in
 * this state and never alters the original game.
 */
export interface VariationMove {
  san: string;
  uci: string;
  from: string;
  to: string;
  fen: string;
}

export interface Variation {
  /** Mainline ply the variation branches from (0 = start position). */
  basePly: number;
  moves: VariationMove[];
  /** Current index into the variation: 0 = at the branch point, n = after n moves. */
  index: number;
}

export interface NavState {
  game: ImportedGame;
  ply: number;
  variation: Variation | null;
}

export type NavAction =
  | { type: "load"; game: ImportedGame; ply?: number }
  | { type: "goto"; ply: number }
  | { type: "first" }
  | { type: "prev" }
  | { type: "next" }
  | { type: "last" }
  | { type: "play"; uci: string }
  | { type: "line"; basePly: number; ucis: string[]; index?: number }
  | { type: "variation-goto"; index: number }
  | { type: "exit-variation" };

export function initNav(game: ImportedGame, ply = 0): NavState {
  return { game, ply: clamp(ply, 0, game.moves.length), variation: null };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function mainlineFen(game: ImportedGame, ply: number): string {
  return ply === 0 ? game.startFen : game.moves[ply - 1].fenAfter;
}

export function currentFen(state: NavState): string {
  const v = state.variation;
  if (v && v.index > 0) return v.moves[v.index - 1].fen;
  return mainlineFen(state.game, v ? v.basePly : state.ply);
}

export function lastMove(state: NavState): { from: string; to: string } | null {
  const v = state.variation;
  if (v && v.index > 0) {
    const m = v.moves[v.index - 1];
    return { from: m.from, to: m.to };
  }
  const ply = v ? v.basePly : state.ply;
  if (ply === 0) return null;
  const m = state.game.moves[ply - 1];
  return { from: m.from, to: m.to };
}

/** Build variation moves from a UCI list, validating every move. */
function buildMoves(fen: string, ucis: string[]): VariationMove[] {
  const chess = new Chess(fen);
  const out: VariationMove[] = [];
  for (const uci of ucis) {
    const m = applyUci(chess, uci);
    if (!m) break;
    out.push({ san: m.san, uci, from: m.from, to: m.to, fen: chess.fen() });
  }
  return out;
}

export function navReducer(state: NavState, action: NavAction): NavState {
  const total = state.game.moves.length;
  const v = state.variation;
  switch (action.type) {
    case "load":
      return initNav(action.game, action.ply ?? 0);
    case "goto":
      return { ...state, ply: clamp(action.ply, 0, total), variation: null };
    case "first":
      return v ? { ...state, variation: { ...v, index: 0 } } : { ...state, ply: 0 };
    case "last":
      return v ? { ...state, variation: { ...v, index: v.moves.length } } : { ...state, ply: total };
    case "prev":
      if (v) {
        if (v.index > 0) return { ...state, variation: { ...v, index: v.index - 1 } };
        return { ...state, ply: v.basePly, variation: null };
      }
      return { ...state, ply: clamp(state.ply - 1, 0, total) };
    case "next":
      if (v) return { ...state, variation: { ...v, index: clamp(v.index + 1, 0, v.moves.length) } };
      return { ...state, ply: clamp(state.ply + 1, 0, total) };
    case "variation-goto":
      return v ? { ...state, variation: { ...v, index: clamp(action.index, 0, v.moves.length) } } : state;
    case "exit-variation":
      return v ? { ...state, ply: v.basePly, variation: null } : state;
    case "line": {
      const basePly = clamp(action.basePly, 0, total);
      const moves = buildMoves(mainlineFen(state.game, basePly), action.ucis);
      if (moves.length === 0) return state;
      return { ...state, ply: basePly, variation: { basePly, moves, index: clamp(action.index ?? 1, 0, moves.length) } };
    }
    case "play": {
      const fen = currentFen(state);
      const [move] = buildMoves(fen, [action.uci]);
      if (!move) return state; // illegal: ignore
      if (!v) {
        const next = state.game.moves[state.ply];
        if (next && next.uci === action.uci) return { ...state, ply: state.ply + 1 };
        return { ...state, variation: { basePly: state.ply, moves: [move], index: 1 } };
      }
      // Inside a variation: follow the existing continuation or truncate and branch.
      const existing = v.moves[v.index];
      if (existing && existing.uci === action.uci) return { ...state, variation: { ...v, index: v.index + 1 } };
      if (v.index === 0) {
        const next = state.game.moves[v.basePly];
        if (next && next.uci === action.uci) return { ...state, ply: v.basePly + 1, variation: null };
      }
      return { ...state, variation: { ...v, moves: [...v.moves.slice(0, v.index), move], index: v.index + 1 } };
    }
  }
}

/** A blank free-analysis game starting from `fen` (validated by the caller). */
export function createLocalGame(fen: string): ImportedGame {
  const chess = new Chess(fen);
  const startFen = chess.fen();
  return {
    id: `local-${startFen.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)}`,
    source: "local",
    originalPgn: "",
    headers: {},
    metadata: { white: "White", black: "Black", result: "*" },
    startFen,
    moves: [],
    customStart: startFen !== new Chess().fen(),
    importedAt: Date.now(),
  };
}

/**
 * Return a new local game with `uci` appended after `ply` (anything after
 * `ply` is discarded). Only valid for source === "local".
 */
export function extendLocalGame(game: ImportedGame, ply: number, uci: string): ImportedGame | null {
  if (game.source !== "local") return null;
  const fen = mainlineFen(game, ply);
  const chess = new Chess(fen);
  const m = applyUci(chess, uci);
  if (!m) return null;
  const moves = game.moves.slice(0, ply);
  moves.push({
    ply: ply + 1,
    moveNumber: Number(fen.split(" ")[5]) || 1,
    color: m.color,
    san: m.san,
    uci,
    from: m.from,
    to: m.to,
    promotion: m.promotion as PlyRecord["promotion"],
    captured: m.captured as PlyRecord["captured"],
    piece: m.piece as PlyRecord["piece"],
    fenBefore: m.before,
    fenAfter: m.after,
  });
  let result: ImportedGame["metadata"]["result"] = "*";
  if (chess.isCheckmate()) result = chess.turn() === "w" ? "0-1" : "1-0";
  else if (chess.isDraw()) result = "1/2-1/2";
  return { ...game, moves, metadata: { ...game.metadata, result } };
}
