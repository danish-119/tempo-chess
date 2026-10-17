import { Chess } from "chess.js";
import { applyUci } from "@/lib/chess/line";
import type { Color } from "@/lib/chess/types";

/**
 * Puzzles come from the Lichess puzzle database (CC0), sampled by
 * scripts/build-puzzles.mjs into src/data/puzzles.json.
 *
 * Format: `fen` is the position BEFORE the opponent's move; `moves` starts
 * with that opponent move, then alternates solver / opponent.
 */
export interface Puzzle {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  themes: string[];
}

export interface PreparedPuzzle {
  puzzle: Puzzle;
  /** Position before the opponent's setup move (shown briefly). */
  setupFen: string;
  setupMove: string;
  /** Position the solver must solve. */
  startFen: string;
  solver: Color;
  /** Remaining line after the setup move: solver, opponent, solver, … */
  solution: string[];
}

let cache: Promise<Puzzle[]> | null = null;

export function loadPuzzles(): Promise<Puzzle[]> {
  cache ??= import("@/data/puzzles.json").then((m) => m.default as Puzzle[]);
  return cache;
}

export function preparePuzzle(puzzle: Puzzle): PreparedPuzzle | null {
  const [setupMove, ...solution] = puzzle.moves.trim().split(/\s+/);
  const chess = new Chess(puzzle.fen);
  if (!setupMove || !applyUci(chess, setupMove) || solution.length === 0) return null;
  return { puzzle, setupFen: puzzle.fen, setupMove, startFen: chess.fen(), solver: chess.turn(), solution };
}

/**
 * Is `uci` correct at solution index `step` from `fen`? The expected move is
 * always accepted; any other move is accepted only if it checkmates (puzzles
 * often have several mates on the final move).
 */
export function isCorrectMove(fen: string, solution: string[], step: number, uci: string): boolean {
  if (solution[step] === uci) return true;
  const chess = new Chess(fen);
  return applyUci(chess, uci) !== null && chess.isCheckmate();
}

export interface PuzzleFilter {
  min: number;
  max: number;
  theme: string | null;
}

export const LEVELS = [
  { id: "beginner", label: "Beginner", min: 0, max: 1000 },
  { id: "intermediate", label: "Intermediate", min: 1000, max: 1600 },
  { id: "advanced", label: "Advanced", min: 1600, max: 2200 },
  { id: "expert", label: "Expert", min: 2200, max: 9999 },
  { id: "any", label: "Any level", min: 0, max: 9999 },
] as const;

export function matching(puzzles: Puzzle[], f: PuzzleFilter): Puzzle[] {
  return puzzles.filter((p) => p.rating >= f.min && p.rating < f.max && (!f.theme || p.themes.includes(f.theme)));
}

/** Random puzzle from the pool, avoiding ones already seen this session when possible. */
export function pickRandom(pool: Puzzle[], seen: Set<string>, random = Math.random): Puzzle | null {
  if (pool.length === 0) return null;
  const fresh = pool.filter((p) => !seen.has(p.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(random() * from.length)];
}

/** Human labels for Lichess puzzle themes. */
export const THEME_LABEL: Record<string, string> = {
  mate: "Checkmate",
  mateIn1: "Mate in 1",
  mateIn2: "Mate in 2",
  mateIn3: "Mate in 3",
  mateIn4: "Mate in 4",
  backRankMate: "Back-rank mate",
  smotheredMate: "Smothered mate",
  anastasiaMate: "Anastasia's mate",
  arabianMate: "Arabian mate",
  hookMate: "Hook mate",
  operaMate: "Opera mate",
  pillsburysMate: "Pillsbury's mate",
  epauletteMate: "Epaulette mate",
  bodenMate: "Boden's mate",
  discoveredCheck: "Discovered check",
  attackingF2F7: "Attack on f2/f7",
  fork: "Fork",
  pin: "Pin",
  skewer: "Skewer",
  discoveredAttack: "Discovered attack",
  doubleCheck: "Double check",
  hangingPiece: "Hanging piece",
  trappedPiece: "Trapped piece",
  sacrifice: "Sacrifice",
  deflection: "Deflection",
  attraction: "Attraction",
  clearance: "Clearance",
  interference: "Interference",
  intermezzo: "Intermezzo",
  xRayAttack: "X-ray",
  zugzwang: "Zugzwang",
  quietMove: "Quiet move",
  defensiveMove: "Defensive move",
  promotion: "Promotion",
  advancedPawn: "Advanced pawn",
  kingsideAttack: "Kingside attack",
  queensideAttack: "Queenside attack",
  exposedKing: "Exposed king",
  capturingDefender: "Capture the defender",
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
  pawnEndgame: "Pawn endgame",
  rookEndgame: "Rook endgame",
  queenEndgame: "Queen endgame",
  bishopEndgame: "Bishop endgame",
  knightEndgame: "Knight endgame",
  advantage: "Win an advantage",
  crushing: "Crushing",
  equality: "Equalize",
};

/** Themes offered in the filter (only those with enough puzzles). */
export function themeOptions(puzzles: Puzzle[], minCount = 15): { id: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of puzzles) for (const t of p.themes) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([id, n]) => THEME_LABEL[id] && n >= minCount)
    .map(([id, count]) => ({ id, label: THEME_LABEL[id], count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
