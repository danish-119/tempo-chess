import type { Puzzle } from "@/lib/puzzles";

/**
 * Tactics and mating patterns for the Learn section. Examples come from the bundled Lichess puzzles tagged with the
 * matching theme, easiest first. Every line is written to be read aloud by the coach exactly as it is shown, so each
 * one is a plain, whole sentence with no brackets or lists.
 */
export interface TacticLesson {
  /** Lichess puzzle theme id. */
  theme: string;
  name: string;
  group: "Basic tactics" | "Advanced tactics" | "Checkmate patterns";
  /** What the idea is, in two or three short sentences. */
  explain: string;
  /** How to spot it in your own games, shown and said once a practice is solved. */
  lookFor: string;
  /** The practice task, e.g. "Find the fork." */
  task: string;
}

export const TACTICS: TacticLesson[] = [
  // ---- Basic tactics
  { theme: "fork", name: "Fork", group: "Basic tactics", task: "Find the fork.",
    explain: "A fork is when one piece attacks two enemy pieces at the same time. Your opponent can only save one of them, so you win the other. Any piece can fork, even a pawn or the king.",
    lookFor: "Knights are the best at forks, and a pawn fork is often the strongest, because both pieces are worth more than the pawn. A fork that gives check is the deadliest, because the king must move first." },
  { theme: "pin", name: "Pin", group: "Basic tactics", task: "Use the pin.",
    explain: "A pin is when a bishop, rook or queen attacks a piece that cannot move without uncovering a more valuable piece behind it. If the piece behind is the king, the pinned piece is not allowed to move at all.",
    lookFor: "Look for enemy pieces lined up with their king or queen on the same line. Then attack the pinned piece again, often with a pawn, because it cannot run away." },
  { theme: "skewer", name: "Skewer", group: "Basic tactics", task: "Find the skewer.",
    explain: "A skewer is a pin the other way round. You attack a valuable piece, such as the king or the queen, and when it moves out of the way, you capture the piece behind it.",
    lookFor: "Look for a king or queen with another piece behind it on the same line. A check along that line is usually the way in." },
  { theme: "discoveredAttack", name: "Discovered attack", group: "Basic tactics", task: "Find the discovered attack.",
    explain: "A discovered attack is when one piece moves out of the way and uncovers an attack by a bishop, rook or queen behind it. The piece that moves can make its own threat too, so there are two threats at once.",
    lookFor: "Look for one of your pieces standing between your long-range piece and an enemy target. Move it with a capture, a check or a threat." },
  { theme: "discoveredCheck", name: "Discovered check", group: "Basic tactics", task: "Find the discovered check.",
    explain: "A discovered check is a discovered attack where the uncovered piece gives check. While your opponent deals with the check, the piece that moved is free to take something anywhere on the board.",
    lookFor: "Look for one of your pieces between your rook, bishop or queen and the enemy king. It can go anywhere, even to a square where it would normally be captured." },
  { theme: "doubleCheck", name: "Double check", group: "Basic tactics", task: "Find the double check.",
    explain: "A double check is when two of your pieces give check at the same time. Nobody can block or capture two checkers at once, so the king has to move, and often there is nowhere safe to go.",
    lookFor: "Look for a discovered check where the moving piece can also give check, even if it lands on a defended square." },
  { theme: "hangingPiece", name: "Hanging piece", group: "Basic tactics", task: "Win the hanging piece.",
    explain: "A hanging piece can be taken for free. It has no defender, or it is attacked more times than it is defended, or it is attacked by something worth less than it is.",
    lookFor: "After every move, ask what is attacked and what is defended, for both sides. Count the attackers and the defenders before you capture." },
  { theme: "trappedPiece", name: "Trapped piece", group: "Basic tactics", task: "Trap the piece.",
    explain: "A trapped piece has no safe square to go to. If you attack it, it is lost, whatever it is worth. Even a queen or a rook can be trapped.",
    lookFor: "Look for bishops and knights on the edge of the board, a rook boxed in by its own king, or a queen that has gone deep into enemy land to grab pawns." },
  { theme: "promotion", name: "Promotion", group: "Basic tactics", task: "Promote the pawn.",
    explain: "When a pawn reaches the last row, it becomes a queen, a rook, a bishop or a knight. Most of the time you choose a queen, but a knight is better when it gives check, and another piece can be better when a queen would give stalemate.",
    lookFor: "Look at the pawns that are close to promoting, and at the one piece stopping each of them. Ask whether you can chase that piece away, block it, or win it." },
  // ---- Advanced tactics
  { theme: "deflection", name: "Deflection", group: "Advanced tactics", task: "Find the deflection.",
    explain: "A deflection forces a defending piece away from the square or the piece it guards. You usually do it by giving it something to capture or a check to answer.",
    lookFor: "Look for an enemy piece that is doing two jobs at once. Give it a reason to give up one of them." },
  { theme: "attraction", name: "Attraction", group: "Advanced tactics", task: "Lure the piece in.",
    explain: "An attraction lures an enemy piece, often the king or the queen, onto a square where you can fork it, pin it, skewer it or checkmate it. It usually starts with a sacrifice.",
    lookFor: "Look for a square where their king or queen would be in big trouble. Then ask whether you can force it to go there." },
  { theme: "capturingDefender", name: "Remove the defender", group: "Advanced tactics", task: "Remove the defender.",
    explain: "Here you capture or chase away the piece that protects something. Once the defender is gone, you can take what it was protecting or break through.",
    lookFor: "Count the attackers and the defenders. If one enemy piece holds everything together, get rid of it, even if it costs you some material." },
  { theme: "clearance", name: "Clearance", group: "Advanced tactics", task: "Clear the way.",
    explain: "A clearance moves one of your own pieces out of the way, ideally with a threat, so that another piece can use the line or the square it was blocking.",
    lookFor: "Look for your own pieces blocking a strong diagonal, an open file or an important square." },
  { theme: "interference", name: "Interference", group: "Advanced tactics", task: "Cut the line.",
    explain: "An interference puts one of your pieces between an enemy piece and the square or piece it defends, so the connection is cut.",
    lookFor: "Look for two enemy pieces protecting each other, or guarding a key square, along a line you can step into." },
  { theme: "intermezzo", name: "In-between move", group: "Advanced tactics", task: "Find the in-between move.",
    explain: "An in-between move is when, instead of the move everyone expects, which is usually taking back a piece, you first play a stronger move such as a check, a capture or a bigger threat.",
    lookFor: "Before you take back a piece without thinking, look for checks, captures and threats, for both sides." },
  { theme: "xRayAttack", name: "X-ray", group: "Advanced tactics", task: "Use the x-ray.",
    explain: "An x-ray is when a long-range piece attacks or defends a square through another piece on the same line. When the piece in between moves or is captured, the hidden attack appears.",
    lookFor: "Look for rooks and queens lined up on a file, or a queen and a bishop on a diagonal. The piece at the back still counts." },
  { theme: "zugzwang", name: "Zugzwang", group: "Advanced tactics", task: "Put your opponent in zugzwang.",
    explain: "Zugzwang is when your opponent would be fine if they could skip their turn, but every move they can make makes their position worse.",
    lookFor: "It happens mostly in endgames with few pieces left. Sometimes the strongest move is a quiet waiting move that makes your opponent move." },
  { theme: "quietMove", name: "Quiet move", group: "Advanced tactics", task: "Find the quiet move.",
    explain: "A quiet move is a calm move with no check and no capture, but it creates a threat your opponent cannot stop. These are often the hardest moves to find.",
    lookFor: "When checks and captures do not work, look for a move that makes two threats or takes away the last good square of a defender." },
  // ---- Checkmate patterns
  { theme: "backRankMate", name: "Back-rank mate", group: "Checkmate patterns", task: "Find the back-rank mate.",
    explain: "In a back-rank mate, a rook or a queen checkmates the king on its back row, where its own pawns block every escape square.",
    lookFor: "Look for a castled king with no escape square and a back row defended only once. To stay safe yourself, give your king some air with a pawn move such as h3." },
  { theme: "smotheredMate", name: "Smothered mate", group: "Checkmate patterns", task: "Find the smothered mate.",
    explain: "In a smothered mate, a knight checkmates a king that is completely surrounded by its own pieces, so it has no square to go to.",
    lookFor: "Look for a king in the corner next to its own rook and pawns. The classic finish is a queen sacrifice that forces a piece to block the last square, and then the knight gives mate." },
  { theme: "anastasiaMate", name: "Anastasia's mate", group: "Checkmate patterns", task: "Find Anastasia's mate.",
    explain: "In Anastasia's mate, a knight and a rook or queen trap the king on the edge of the board, with its own pawn blocking the way out.",
    lookFor: "Look for a knight on e7 or e2 that covers the escape squares, while your rook or queen gives check down the side of the board." },
  { theme: "arabianMate", name: "Arabian mate", group: "Checkmate patterns", task: "Find the Arabian mate.",
    explain: "The Arabian mate is one of the oldest checkmates. A rook and a knight work together to checkmate a king in the corner.",
    lookFor: "Look for a knight two squares diagonally away from the corner, such as on f6 against a king on h8. It protects the rook that gives check right next to the king." },
  { theme: "hookMate", name: "Hook mate", group: "Checkmate patterns", task: "Find the hook mate.",
    explain: "In a hook mate, a rook, a knight and a pawn work together. The pawn protects the knight, the knight protects the rook, and the rook gives checkmate.",
    lookFor: "Look for a king near the edge of the board with your knight and a pawn close by to support a rook check." },
  { theme: "operaMate", name: "Opera mate", group: "Checkmate patterns", task: "Find the Opera mate.",
    explain: "In the Opera mate, a rook checkmates on the back row while a bishop guards the escape square. It is named after a famous game Paul Morphy played at the opera in 1858.",
    lookFor: "Look for an open file in front of the enemy king and your bishop on the diagonal next to it." },
  { theme: "pillsburysMate", name: "Pillsbury's mate", group: "Checkmate patterns", task: "Find Pillsbury's mate.",
    explain: "In Pillsbury's mate, a rook checkmates on the g-file or a file nearby, while a bishop on the long diagonal covers the escape square.",
    lookFor: "Look for a king whose g-pawn has gone, with your bishop on the long diagonal and a rook ready to swing over to the g-file." },
  { theme: "epauletteMate", name: "Epaulette mate", group: "Checkmate patterns", task: "Find the epaulette mate.",
    explain: "In an epaulette mate, a queen checkmates a king whose escape squares on both sides are blocked by its own pieces, like the pads on a soldier's shoulders.",
    lookFor: "Look for a king on the edge of the board with its own pieces on both sides, and give check with the queen from straight in front." },
  { theme: "bodenMate", name: "Boden's mate", group: "Checkmate patterns", task: "Find Boden's mate.",
    explain: "In Boden's mate, two bishops on crossing diagonals checkmate the king. It usually happens to a king that has castled on the queen's side and is boxed in by its own pieces.",
    lookFor: "Look for a king on c8 or c1 blocked in by its own pieces. A sacrifice that opens a diagonal often starts it." },
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

/** How many practices a tactic lesson asks for before it counts as learned. */
export const TACTIC_PRACTICES = 3;
