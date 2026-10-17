import type { Outcome } from "@/lib/tablebase";

/**
 * Endgame trainer lessons. Every start position was checked against the
 * Lichess tablebase (the expected result is in `goal`). The trainer plays the
 * defending side perfectly (best tablebase move) and flags any move that
 * changes the result for the worse.
 */
export interface EndgameLesson {
  id: string;
  title: string;
  /** Short group label for the picker. */
  group: "Basic mates" | "Pawn endings" | "Rook endings" | "Queen endings" | "Minor pieces";
  goal: "win" | "draw";
  fen: string;
  /** Finish early once a pawn promotes (the rest is a basic mate). */
  untilPromotion?: boolean;
  /** For draw lessons: how many of your moves you must hold. */
  holdMoves?: number;
  tip: string;
}

export const ENDGAME_LESSONS: EndgameLesson[] = [
  // ---- Basic mates
  { id: "kq-k", title: "Queen mate", group: "Basic mates", goal: "win", fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1",
    tip: "Use the queen to shrink the king's box a knight's move away, then bring your king up. Watch out for stalemate." },
  { id: "krr-k", title: "Two rooks (ladder)", group: "Basic mates", goal: "win", fen: "8/8/8/4k3/8/8/8/R3K2R w - - 0 1",
    tip: "The rooks take turns checking and cutting off a rank, walking the king to the edge like a ladder." },
  { id: "kr-k", title: "Rook mate", group: "Basic mates", goal: "win", fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1",
    tip: "Cut the king off with the rook, walk your king up to take the opposition, then check along the edge." },
  { id: "kbb-k", title: "Two bishops", group: "Basic mates", goal: "win", fen: "8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1",
    tip: "Side by side, the bishops form a wall. Push the king to a corner with your king's help." },
  { id: "kbn-k", title: "Bishop and knight", group: "Basic mates", goal: "win", fen: "8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1",
    tip: "The hardest basic mate: drive the king to a corner of your bishop's colour. You have 50 moves." },
  // ---- Pawn endings
  { id: "square", title: "Rule of the square", group: "Pawn endings", goal: "win", fen: "8/8/8/8/k7/8/6P1/7K w - - 0 1", untilPromotion: true,
    tip: "Draw a square from the pawn to its promotion rank. If the enemy king can't step into it, just run." },
  { id: "kp-k-opposition", title: "Opposition", group: "Pawn endings", goal: "win", fen: "2k5/8/8/8/8/8/3P4/3K4 w - - 0 1", untilPromotion: true,
    tip: "King first, pawn later. Get your king in front of the pawn and use the opposition to reach the key squares." },
  { id: "kp-k-sixth", title: "King on the sixth", group: "Pawn endings", goal: "win", fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", untilPromotion: true,
    tip: "With your king on the sixth rank in front of the pawn, the win is always there — don't stalemate." },
  { id: "kp-k-defend", title: "Defend king and pawn", group: "Pawn endings", goal: "draw", fen: "4k3/8/8/8/8/8/4P3/4K3 b - - 0 1", holdMoves: 15,
    tip: "Stay in front of the pawn and take the opposition whenever the white king comes close." },
  { id: "rook-pawn", title: "Rook-pawn draw", group: "Pawn endings", goal: "draw", fen: "k7/8/K7/P7/8/8/8/8 b - - 0 1", holdMoves: 10,
    tip: "Against an a- or h-pawn, a king that reaches the corner can never be driven out." },
  { id: "outside-passer", title: "Outside passed pawn", group: "Pawn endings", goal: "win", fen: "8/p4k2/8/8/8/8/P4KP1/8 w - - 0 1", untilPromotion: true,
    tip: "Use the far-away pawn as a decoy: while the enemy king chases it, your king eats the other pawns." },
  // ---- Rook endings
  { id: "lucena", title: "Lucena position", group: "Rook endings", goal: "win", fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1", untilPromotion: true,
    tip: "Check the enemy king away first, then “build a bridge”: bring your rook to the fourth rank to block checks." },
  { id: "philidor", title: "Philidor defence", group: "Rook endings", goal: "draw", fen: "4k3/7R/r7/4PK2/8/8/8/8 b - - 0 1", holdMoves: 20,
    tip: "Keep your rook on the sixth rank until the pawn advances, then check from behind." },
  { id: "cut-off", title: "King cut off", group: "Rook endings", goal: "win", fen: "8/8/3k4/8/8/4PK2/8/R7 w - - 0 1", untilPromotion: true,
    tip: "Use your rook to cut the defending king off from the pawn's file, then escort the pawn with your king." },
  // ---- Queen endings
  { id: "q-vs-p", title: "Queen vs pawn on the 7th", group: "Queen endings", goal: "win", fen: "K7/8/8/8/8/8/3pk3/7Q w - - 0 1",
    tip: "Check until the king must stand in front of its pawn, then use that tempo to bring your king closer." },
  { id: "q-vs-r", title: "Queen vs rook", group: "Queen endings", goal: "win", fen: "3k4/3r4/3K4/8/8/8/8/7Q w - - 0 1",
    tip: "Force the rook away from its king with checks and forks; this one is hard even for masters." },
  // ---- Minor pieces
  { id: "right-bishop", title: "Bishop and rook pawn", group: "Minor pieces", goal: "win", fen: "7k/8/6K1/7P/8/8/8/2B5 w - - 0 1", untilPromotion: true,
    tip: "With the bishop that controls the promotion square, the rook pawn wins." },
  { id: "wrong-bishop", title: "Wrong-coloured bishop", group: "Minor pieces", goal: "draw", fen: "7k/8/6K1/7P/8/8/8/3B4 b - - 0 1", holdMoves: 15,
    tip: "If the bishop can't cover the corner square, a king in the corner holds the draw. Shuffle and avoid getting boxed out." },
];

export function lessonById(id: string | null | undefined): EndgameLesson | null {
  return ENDGAME_LESSONS.find((l) => l.id === id) ?? null;
}

const RANK: Record<Outcome, number> = { loss: 0, draw: 1, win: 2, unknown: -1 };

/** True when `after` is a worse result than `before` (unknowns never count). */
export function isWorse(before: Outcome, after: Outcome): boolean {
  if (before === "unknown" || after === "unknown") return false;
  return RANK[after] < RANK[before];
}

/** What a mistake means, in words. */
export function mistakeText(before: Outcome, after: Outcome): string {
  if (before === "win" && after === "draw") return "That throws away the win — the position is now a draw.";
  if (before === "win" && after === "loss") return "That move loses — the position was winning.";
  return "That move loses — the position was a draw.";
}
