import type { Puzzle } from "@/lib/puzzles";

/**
 * Tactics and mating patterns for the Learn section. Examples come from the
 * bundled Lichess puzzles tagged with the matching theme, easiest first.
 */
export interface TacticLesson {
  /** Lichess puzzle theme id. */
  theme: string;
  name: string;
  group: "Basic tactics" | "Advanced tactics" | "Checkmate patterns";
  explain: string;
  lookFor: string;
}

export const TACTICS: TacticLesson[] = [
  // ---- Basic tactics
  { theme: "fork", name: "Fork", group: "Basic tactics",
    explain: "One piece attacks two (or more) enemy pieces at once. The opponent can only save one. Any piece can fork — knight, pawn, bishop, rook, queen, even the king.",
    lookFor: "Knights are the classic forkers, and a pawn fork is often the strongest: a pawn stepping between two pieces attacks both, and either one is worth more than the pawn. Forks with check are deadly, because the king must move first." },
  { theme: "pin", name: "Pin", group: "Basic tactics",
    explain: "A bishop, rook or queen attacks a piece that can't move without exposing a more valuable piece behind it. If the piece behind is the king, the pinned piece may not move at all (an absolute pin); otherwise moving it just loses material (a relative pin).",
    lookFor: "Pieces lined up with their king or queen on a file, rank or diagonal. Then attack the pinned piece again — often with a pawn — because it can't run away." },
  { theme: "skewer", name: "Skewer", group: "Basic tactics",
    explain: "A pin in reverse: a bishop, rook or queen attacks a valuable piece (often the king or queen) that must move away, and the piece behind it is then captured.",
    lookFor: "A king or queen with another piece behind it on the same line — checks along that line are the usual way in." },
  { theme: "discoveredAttack", name: "Discovered attack", group: "Basic tactics",
    explain: "One piece moves out of the way and uncovers an attack by a bishop, rook or queen behind it. The piece that moved can make its own threat too, so there are two threats at once. Any piece can be the one that moves — even a pawn or the king.",
    lookFor: "Your own piece standing between your long-range piece and an enemy target. Move it with a capture, check or threat." },
  { theme: "discoveredCheck", name: "Discovered check", group: "Basic tactics",
    explain: "A discovered attack where the uncovered piece gives check. While the opponent deals with the check, the piece that moved is free to grab material anywhere.",
    lookFor: "Your piece between your rook, bishop or queen and the enemy king — it can go anywhere, even to a square where it would normally be captured." },
  { theme: "doubleCheck", name: "Double check", group: "Basic tactics",
    explain: "Both the moving piece and the uncovered piece give check. Nothing can block or capture two checkers at once, so the king must move — often straight into mate.",
    lookFor: "Discovered-check setups where the moving piece can also land on a checking square, even if it's defended there." },
  { theme: "hangingPiece", name: "Hanging piece", group: "Basic tactics",
    explain: "A piece that can be taken for free: it's undefended, or attacked more times than it's defended, or attacked by something worth less than it.",
    lookFor: "After every move, ask what's attacked and what's defended — for both sides. Count attackers and defenders before you capture." },
  { theme: "trappedPiece", name: "Trapped piece", group: "Basic tactics",
    explain: "A piece with no safe squares to go to. Attack it and it's lost, whatever its value — even a queen or rook can be trapped.",
    lookFor: "Bishops and knights on the edge, a rook boxed in by its own king, or a queen that went pawn-grabbing deep in enemy territory." },
  { theme: "promotion", name: "Promotion", group: "Basic tactics",
    explain: "A pawn reaching the last rank becomes a queen, rook, bishop or knight. Promoting to something other than a queen (underpromotion) is right when a knight gives check or a queen would stalemate.",
    lookFor: "Advanced passed pawns and the one piece stopping them — can you deflect it, block its line, or win it?" },
  // ---- Advanced tactics
  { theme: "deflection", name: "Deflection", group: "Advanced tactics",
    explain: "Force a defending piece away from the square or piece it guards — usually by giving it something to capture or a check to answer.",
    lookFor: "An enemy piece doing two jobs at once (overloaded). Give it a reason to abandon one of them." },
  { theme: "attraction", name: "Attraction (decoy)", group: "Advanced tactics",
    explain: "Lure an enemy piece — often the king or queen — onto a square where it can be forked, pinned, skewered or mated, usually with a sacrifice.",
    lookFor: "A square where, if their king or queen stood there, you'd have a killer follow-up. Can you force it there?" },
  { theme: "capturingDefender", name: "Remove the defender", group: "Advanced tactics",
    explain: "Capture (or chase away) the piece that protects something, then take what it was protecting or break through.",
    lookFor: "Count attackers and defenders. If one piece holds everything together, eliminate it — even at the cost of an exchange." },
  { theme: "clearance", name: "Clearance", group: "Advanced tactics",
    explain: "Move one of your own pieces out of the way, ideally with a threat, so another piece can use the line or square it was blocking.",
    lookFor: "Your own pieces blocking a strong diagonal, file or key square." },
  { theme: "interference", name: "Interference", group: "Advanced tactics",
    explain: "Put a piece between an enemy piece and the square or piece it defends, cutting the connection.",
    lookFor: "Two enemy pieces protecting each other or a key square along a line you can step into." },
  { theme: "intermezzo", name: "In-between move", group: "Advanced tactics",
    explain: "Instead of the expected move — usually a recapture — first play a stronger one: a check, a capture or a bigger threat. Also called a zwischenzug.",
    lookFor: "Before recapturing automatically, look for checks, captures and threats for both sides." },
  { theme: "xRayAttack", name: "X-ray", group: "Advanced tactics",
    explain: "A long-range piece attacks or defends a square through another piece on the same line. When the piece in between moves or is captured, the hidden attack or defence appears.",
    lookFor: "Rooks and queens stacked on a file, or a queen and bishop on a diagonal — the back piece still counts." },
  { theme: "zugzwang", name: "Zugzwang", group: "Advanced tactics",
    explain: "The opponent would be fine if they could pass, but every legal move makes their position worse.",
    lookFor: "Mostly in endgames with few pieces. Sometimes the strongest move is a quiet waiting move that hands them the obligation to move." },
  { theme: "quietMove", name: "Quiet move", group: "Advanced tactics",
    explain: "A calm move with no check or capture that creates a threat the opponent can't meet — often the hardest moves to find.",
    lookFor: "When checks and captures don't work, look for a move that creates two threats or takes away the defender's last good square." },
  // ---- Checkmate patterns
  { theme: "backRankMate", name: "Back-rank mate", group: "Checkmate patterns",
    explain: "A rook or queen mates the king on its back rank, where its own pawns block every escape square.",
    lookFor: "A castled king with no escape square and a back rank defended only once — deflect that defender. To defend, give your king 'luft' with a pawn move like h3." },
  { theme: "smotheredMate", name: "Smothered mate", group: "Checkmate patterns",
    explain: "A knight mates a king that is completely surrounded by its own pieces, so it has no squares to go to.",
    lookFor: "A cornered king next to its own rook and pawns. The classic finish: a queen sacrifice that forces a piece to block the last square, then the knight mates." },
  { theme: "anastasiaMate", name: "Anastasia's mate", group: "Checkmate patterns",
    explain: "A knight and a rook (or queen) trap the king on the edge of the board, with its own pawn blocking an escape.",
    lookFor: "A knight on e7 (or e2) covering the escape squares while the rook or queen checks down the h-file." },
  { theme: "arabianMate", name: "Arabian mate", group: "Checkmate patterns",
    explain: "One of the oldest mates: a rook and a knight mate a king in the corner.",
    lookFor: "A knight two squares diagonally from the corner (like f6 against h8), protecting the rook that checks next to the king." },
  { theme: "hookMate", name: "Hook mate", group: "Checkmate patterns",
    explain: "A rook, a knight and a pawn work together: the pawn protects the knight, the knight protects the rook, and the rook gives mate.",
    lookFor: "A king near the edge with your knight and pawn close by to support a rook check." },
  { theme: "operaMate", name: "Opera mate", group: "Checkmate patterns",
    explain: "A rook mates on the back rank while a bishop guards the escape square — made famous by Morphy's Opera Game (1858).",
    lookFor: "An open file in front of the king and your bishop on the diagonal next to it." },
  { theme: "pillsburysMate", name: "Pillsbury's mate", group: "Checkmate patterns",
    explain: "A rook mates on the g-file (or a nearby file) while a bishop on the long diagonal covers the escape square.",
    lookFor: "A king whose g-pawn has gone, with your bishop on the long diagonal and a rook ready to swing to the g-file." },
  { theme: "epauletteMate", name: "Epaulette mate", group: "Checkmate patterns",
    explain: "A queen mates a king whose escape squares on both sides are blocked by its own pieces, like shoulder pads.",
    lookFor: "A king on the edge flanked by its own rooks or pieces, with a queen check from straight in front." },
  { theme: "bodenMate", name: "Boden's mate", group: "Checkmate patterns",
    explain: "Two bishops on crossing diagonals mate a king, usually one that castled queenside and is hemmed in by its own pieces.",
    lookFor: "A king on c8 (or c1) blocked by its own pieces on d7/b7 — a sacrifice that opens a diagonal often starts it." },
];

export const TACTIC_GROUPS = [...new Set(TACTICS.map((t) => t.group))];

export function tacticByTheme(theme: string | null | undefined): TacticLesson | null {
  return TACTICS.find((t) => t.theme === theme) ?? null;
}

/** Example puzzles for a theme, easiest first. */
export function examplesFor(puzzles: Puzzle[], theme: string, max = 12): Puzzle[] {
  return puzzles
    .filter((p) => p.themes.includes(theme))
    .sort((a, b) => a.rating - b.rating)
    .slice(0, max);
}
