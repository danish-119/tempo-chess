import { Chess } from "chess.js";

/**
 * "Basics": a first course for someone who has never played. Each lesson explains one idea in a sentence or two,
 * often with example boards, and then asks the learner to do it two or three times on the board while the coach
 * talks them through. The order follows how beginner courses usually teach: the goal, the pieces one at a time,
 * capturing, the special moves, check and how to answer it, checkmate, stalemate and draws, a few first mates, then
 * the ideas that make a good opening.
 */

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type BasicsGoal =
  /** Make one of these moves ([from, to]); the targets are starred on the board. */
  | { kind: "move"; any: readonly (readonly [string, string])[]; promotion?: "q" | "r" | "b" | "n" }
  /** Any legal move will do. */
  | { kind: "any" }
  /** Any move that gives checkmate. */
  | { kind: "mate" }
  /** Tap this square on the board (for learning the names of the squares). */
  | { kind: "square"; square: string };

/** One thing to do on the board. */
export interface Drill {
  fen: string;
  goal: BasicsGoal;
  /** What to do. */
  task: string;
  /** Said and shown when it is done; a lesson's default is used if absent. */
  done?: string;
  /** A tempting move that teaches something when it is played. */
  traps?: readonly { from: string; to: string; say: string }[];
  /** Show no stars and no arrows: the point is to choose for yourself. */
  plain?: boolean;
}

/** A small picture that shows an idea. */
export interface Example {
  fen: string;
  caption: string;
  glow?: readonly string[];
}

export interface BasicsLesson {
  id: string;
  chapter: string;
  title: string;
  /** One or two short sentences that teach the idea. */
  text: string;
  /** Said after each practice is done. */
  done?: string;
  /** How to use the piece well, shown (with a picture) once the practice is finished. */
  tip?: { text: string; example?: Example };
  /** Pictures that show the idea. */
  examples?: readonly Example[];
  /** The position shown when there is nothing to practise. */
  fen?: string;
  /** Two or three things to do on the board. */
  drills?: readonly Drill[];
  /** The last step offers the next places to go. */
  final?: boolean;
  /** Show the pieces with their names, so each can be lit up on the board. */
  legend?: boolean;
  /** Draw the files and ranks on the example boards. */
  coords?: boolean;
}

export const BASICS: readonly BasicsLesson[] = [
  {
    id: "board",
    chapter: "The board",
    title: "The goal",
    text: "Chess is played by two players, White and Black, on a board of 64 squares. There are 8 columns and 8 rows, with 32 light and 32 dark squares. Each player starts with 16 pieces, 32 in all. Your aim is to trap the enemy king, and that is called checkmate. White always starts at the bottom.",
    fen: START,
  },
  {
    id: "setup",
    chapter: "The board",
    title: "The pieces",
    text: "Each side has 16 pieces of six different kinds. Tap each piece below to see its name and where it starts. The rooks go in the corners, then the knights, then the bishops. The queen goes on her own colour, and the king stands beside her. White moves first, and then the players take turns. You cannot skip a turn.",
    legend: true,
    examples: [
      { fen: START, caption: "The rooks start in the corners.", glow: ["a1", "h1", "a8", "h8"] },
      { fen: START, caption: "Each queen starts on her own colour.", glow: ["d1", "d8"] },
      { fen: START, caption: "The bottom-left square is always dark.", glow: ["a1"] },
    ],
    fen: START,
  },
  {
    id: "squares",
    chapter: "The board",
    title: "Naming the squares",
    text: "The columns are called files, and they go from a to h, left to right. The rows are called ranks, and they go from 1 to 8, starting from White's side. A square is named by its file and then its rank, so the white king starts on e1. Knowing the names lets you read moves and follow lessons.",
    done: "Now you know your way around the board.",
    examples: [
      { fen: START, caption: "The square e1 is on file e and rank 1.", glow: ["e1"] },
      { fen: START, caption: "The square e4 is in the middle of the board.", glow: ["e4"] },
      { fen: START, caption: "The square h8 is in the far corner.", glow: ["h8"] },
    ],
    coords: true,
    drills: [
      { fen: START, goal: { kind: "square", square: "e4" }, task: "Tap the square e4." },
      { fen: START, goal: { kind: "square", square: "b7" }, task: "Tap the square b7." },
      { fen: START, goal: { kind: "square", square: "h3" }, task: "Tap the square h3." },
    ],
  },
  {
    id: "rook",
    chapter: "How pieces move",
    title: "The rook",
    text: "You have two rooks, one in each corner. A rook slides any number of squares in a straight line, up, down or sideways. It cannot jump over other pieces.",
    done: "Well done. Rooks always go straight and never diagonally.",
    tip: {
      text: "Rooks love open files, which are columns with no pawns in the way. Put your rooks there, and keep them connected so they guard each other.",
      example: { fen: "6k1/pp3ppp/8/8/8/8/PP3PPP/4R1K1 w - - 0 1", caption: "This rook stands on an open file.", glow: ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"] },
    },
    drills: [
      { fen: "7k/8/8/8/8/8/8/R3K3 w - - 0 1", goal: { kind: "move", any: [["a1", "a5"]] }, task: "Move the rook up to the star." },
      { fen: "k7/8/8/8/8/8/4K3/7R w - - 0 1", goal: { kind: "move", any: [["h1", "c1"]] }, task: "Slide the rook sideways to the star." },
      { fen: "k7/8/8/8/3p4/8/4K3/3R4 w - - 0 1", goal: { kind: "move", any: [["d1", "d4"]] }, task: "Capture the pawn with your rook." },
    ],
  },
  {
    id: "bishop",
    chapter: "How pieces move",
    title: "The bishop",
    text: "You have two bishops, one for the light squares and one for the dark squares. A bishop slides diagonally, so it always stays on the same colour.",
    done: "Well done. Each bishop stays on its own colour for the whole game.",
    tip: {
      text: "Bishops like long, open diagonals. Keep your own pawns on the other colour so they do not block your bishop. Two bishops together make a strong pair.",
      example: { fen: "rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPPBP/RNBQK1NR b KQkq - 1 2", caption: "This bishop sits on the long diagonal.", glow: ["g2", "f3", "e4", "d5", "c6", "b7", "a8"] },
    },
    drills: [
      { fen: "k7/8/8/8/8/8/8/2B1K3 w - - 0 1", goal: { kind: "move", any: [["c1", "f4"]] }, task: "Move the bishop to the star." },
      { fen: "k7/8/8/8/8/8/8/4KB2 w - - 0 1", goal: { kind: "move", any: [["f1", "c4"]] }, task: "Slide the bishop to the star." },
      { fen: "k7/8/8/8/5p2/8/8/2B1K3 w - - 0 1", goal: { kind: "move", any: [["c1", "f4"]] }, task: "Capture the pawn with your bishop." },
    ],
  },
  {
    id: "queen",
    chapter: "How pieces move",
    title: "The queen",
    text: "You have one queen. She is the strongest piece, and she moves like a rook and a bishop together.",
    done: "Well done. The queen can go straight or diagonally, as far as she likes.",
    tip: {
      text: "Do not rush your queen out, because smaller pieces can chase her and win time. Bring out your knights and bishops first, and then use her.",
      example: { fen: "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2", caption: "Out this early, the queen will be chased.", glow: ["h5"] },
    },
    drills: [
      { fen: "7k/8/8/8/8/8/8/3QK3 w - - 0 1", goal: { kind: "move", any: [["d1", "g4"]] }, task: "Move the queen diagonally to the star." },
      { fen: "8/8/7k/8/8/8/8/Q3K3 w - - 0 1", goal: { kind: "move", any: [["a1", "a5"]] }, task: "Move the queen in a straight line to the star." },
      { fen: "7k/8/8/8/3n4/8/8/3QK3 w - - 0 1", goal: { kind: "move", any: [["d1", "d4"]] }, task: "Capture the knight with your queen." },
    ],
  },
  {
    id: "king",
    chapter: "How pieces move",
    title: "The king",
    text: "You have one king. He moves one square in any direction, up, down, sideways or diagonally. But he may never step onto a square the enemy attacks, because that would be moving into check.",
    done: "Well done. The king moves one step at a time, and only to safe squares.",
    tip: {
      text: "Early in the game, keep your king safe by castling, and leave the pawns in front of him alone. In the endgame, when only a few pieces are left, bring him to the middle, where he becomes a strong fighter.",
      example: { fen: "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 8 6", caption: "This king has castled and is safe behind his pawns.", glow: ["g1", "f2", "g2", "h2"] },
    },
    drills: [
      { fen: "7k/8/8/8/8/8/8/4K3 w - - 0 1", goal: { kind: "move", any: [["e1", "e2"]] }, task: "Move the king one square, to the star." },
      {
        fen: "7k/8/8/8/8/8/r7/4K3 w - - 0 1",
        goal: { kind: "move", any: [["e1", "d1"], ["e1", "f1"]] },
        task: "The black rook guards the whole second row. Move your king to a safe square.",
      },
      { fen: "7k/8/8/8/8/8/4p3/4K3 w - - 0 1", goal: { kind: "move", any: [["e1", "e2"]] }, task: "Capture the pawn with your king." },
    ],
  },
  {
    id: "knight",
    chapter: "How pieces move",
    title: "The knight",
    text: "You have two knights. A knight jumps in an L shape, two squares one way and then one to the side. It is the only piece that can jump over others.",
    done: "Well done. The knight is the only piece that can jump.",
    tip: {
      text: "Knights are strongest in the centre, where they attack the most squares. A knight on the edge is weak, so remember that a knight on the rim is dim.",
      example: { fen: "7k/8/8/8/3N4/8/8/4K3 w - - 0 1", caption: "In the centre, a knight attacks eight squares.", glow: ["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"] },
    },
    drills: [
      { fen: "7k/8/8/8/8/8/8/1N2K3 w - - 0 1", goal: { kind: "move", any: [["b1", "a3"], ["b1", "c3"], ["b1", "d2"]] }, task: "Move the knight to a star." },
      {
        fen: "4k3/8/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
        goal: { kind: "move", any: [["b1", "a3"], ["b1", "c3"], ["g1", "f3"], ["g1", "h3"]] },
        task: "Jump a knight over the pawns to a star.",
      },
      { fen: "7k/8/8/4p3/8/3N4/8/4K3 w - - 0 1", goal: { kind: "move", any: [["d3", "e5"]] }, task: "Capture the pawn with your knight." },
    ],
  },
  {
    id: "knight-fork",
    chapter: "How pieces move",
    title: "The knight fork",
    text: "A fork attacks two enemy pieces at once, so your opponent can save only one. Knights are the best at forks, because their jump is hard to see coming and cannot be blocked. A fork that attacks the king is the strongest, because the king must move.",
    done: "That is a fork, and now you will win a piece.",
    tip: {
      text: "Look for a square where your knight attacks two valuable pieces, best of all the king and a queen or a rook. Make sure the knight cannot simply be captured when it lands.",
      example: { fen: "8/8/2k1q3/8/3N4/8/8/6K1 b - - 0 1", caption: "This knight attacks the king and the queen at once.", glow: ["d4", "c6", "e6"] },
    },
    examples: [
      { fen: "r3k3/2N5/8/8/8/8/8/2R1K3 b - - 0 1", caption: "The knight on c7 attacks the king and the rook.", glow: ["c7", "e8", "a8"] },
      { fen: "8/8/2k1q3/8/3N4/8/8/6K1 b - - 0 1", caption: "The knight on d4 attacks the king and the queen.", glow: ["d4", "c6", "e6"] },
    ],
    drills: [
      { fen: "r3k3/8/8/3N4/8/8/8/2R1K3 w - - 0 1", goal: { kind: "move", any: [["d5", "c7"]] }, task: "Fork the king and the rook with your knight." },
      { fen: "8/8/2k1q3/8/8/1N6/8/6K1 w - - 0 1", goal: { kind: "move", any: [["b3", "d4"]] }, task: "Fork the king and the queen." },
    ],
  },
  {
    id: "pawn",
    chapter: "How pieces move",
    title: "The pawn",
    text: "You have eight pawns. They are the smallest pieces, and you have more of them than anything else. A pawn moves forward one square, but from its starting square it may move two.",
    done: "Well done. Remember that pawns never move backwards.",
    tip: {
      text: "Keep your pawns together in a chain, so each one guards the next. Pawns cannot go back, so move them with care. A pawn standing on its own is an easy target.",
      example: { fen: "6k1/8/8/8/3P4/2P5/1P6/6K1 w - - 0 1", caption: "In this pawn chain, each pawn guards the next one.", glow: ["b2", "c3", "d4"] },
    },
    drills: [
      { fen: "7k/8/8/8/8/8/4P3/4K3 w - - 0 1", goal: { kind: "move", any: [["e2", "e3"], ["e2", "e4"]] }, task: "Move the pawn forward one or two squares." },
      { fen: "7k/8/8/8/4P3/8/8/4K3 w - - 0 1", goal: { kind: "move", any: [["e4", "e5"]] }, task: "This pawn has moved already, so it goes one square." },
    ],
  },
  {
    id: "capture",
    chapter: "Capturing",
    title: "Capturing with a pawn",
    text: "Most pieces capture by moving onto an enemy piece. Pawns are different, because they capture one square diagonally forward, not straight ahead. Capturing is never forced, so you may always make a different move.",
    done: "Well done. You took it off the board.",
    tip: {
      text: "You do not have to capture. Sometimes pushing a pawn ahead or bringing out a piece is the better move. Look at the whole board first, and then choose.",
      example: { fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2", caption: "Here you could take on d5, push the pawn to e5, or bring the knight to c3.", glow: ["d5", "e5", "c3"] },
    },
    drills: [
      { fen: "7k/8/8/3p4/4P3/8/8/4K3 w - - 0 1", goal: { kind: "move", any: [["e4", "d5"]] }, task: "Capture the black pawn." },
      { fen: "7k/8/8/5p2/4P3/8/8/4K3 w - - 0 1", goal: { kind: "move", any: [["e4", "f5"]] }, task: "Now capture on the other side." },
      { fen: "7k/8/8/3p1p2/4P3/8/8/4K3 w - - 0 1", goal: { kind: "move", any: [["e4", "d5"], ["e4", "f5"]] }, task: "Capture either pawn." },
    ],
  },
  {
    id: "free-piece",
    chapter: "Capturing",
    title: "Take a free piece, or not",
    text: "Before each move, look for enemy pieces nobody is guarding. You can take them for free. But if a piece is guarded, taking it may cost you more than you win.",
    done: "Good choice. Always look before you capture.",
    tip: {
      text: "Before you capture, ask yourself three questions. Is the piece guarded? Is the trade fair? Is there a better move? If the answer is not clear, you do not have to take.",
      example: { fen: "4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1", caption: "The pawn on d5 is guarded, so taking it would lose your queen.", glow: ["d5", "c6"] },
    },
    drills: [
      { fen: "4k3/8/8/3n4/8/8/3Q4/4K3 w - - 0 1", goal: { kind: "move", any: [["d2", "d5"]] }, task: "Capture the knight with your queen." },
      { fen: "4k3/8/8/8/2b5/8/8/2R1K3 w - - 0 1", goal: { kind: "move", any: [["c1", "c4"]] }, task: "Capture the bishop with your rook." },
      {
        fen: "4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1",
        goal: { kind: "move", any: [["e1", "e2"], ["e1", "d1"], ["e1", "f1"], ["d2", "d3"], ["d2", "e3"], ["d2", "c3"]] },
        task: "Look closely before you take. Make a safe move instead of capturing.",
        plain: true,
        traps: [{ from: "d2", to: "d5", say: "That pawn was guarded by the pawn on c6, so you would give away your queen for a pawn. You never have to capture, so always look first." }],
      },
    ],
  },
  {
    id: "protect",
    chapter: "Capturing",
    title: "Protect your pieces",
    text: "A piece is protected when a friendly piece could recapture if an enemy took it. Unprotected pieces can be won for free. Before you move, check that every piece of yours is protected or out of danger.",
    examples: [
      { fen: "4k3/8/8/3n4/8/8/3Q4/4K3 b - - 0 1", caption: "This knight is not protected, so it can be taken for free.", glow: ["d5"] },
      { fen: "4k3/8/2p5/3p4/8/8/3Q4/4K3 b - - 0 1", caption: "This pawn is protected by the pawn on c6.", glow: ["d5", "c6"] },
      { fen: "4k3/8/8/8/3N4/8/3R4/4K3 w - - 0 1", caption: "This knight is guarded by the rook.", glow: ["d4", "d2"] },
    ],
    fen: "4k3/8/2p5/3p4/8/8/3Q4/4K3 b - - 0 1",
  },
  {
    id: "values",
    chapter: "Capturing",
    title: "What pieces are worth",
    text: "Each piece has a value. A pawn is worth 1, a knight 3, a bishop 3, a rook 5 and a queen 9. Trading a piece for one of the same value is fair, but giving a bigger piece for a smaller one loses material. When you are ahead, trades help you, and when you are behind, try to avoid them.",
    examples: [
      { fen: "4k3/8/2b5/8/3N4/8/8/4K3 w - - 0 1", caption: "A knight for a bishop is an even trade.", glow: ["d4", "c6"] },
      { fen: "4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1", caption: "A queen for a pawn is a bad trade.", glow: ["d2", "d5"] },
      { fen: "4k3/8/8/3r4/8/8/3N4/R3K3 w - - 0 1", caption: "A knight for a rook is a good trade.", glow: ["d2", "d5"] },
    ],
    fen: START,
  },
  {
    id: "castle",
    chapter: "Special moves",
    title: "Castling",
    text: "Once per game, the king can move two squares towards a rook, and the rook jumps over to his other side. This tucks the king away safely. You cannot castle if the king or that rook has already moved, if the king is in check, if he would pass over or land on an attacked square, or if a piece is in the way.",
    done: "Well done. Your king is safe and your rook is ready to play.",
    examples: [
      { fen: "4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1", caption: "The king is in check, so he cannot castle.", glow: ["e1", "e8"] },
      { fen: "5r1k/8/8/8/8/8/8/R3K2R w KQ - 0 1", caption: "The square f1 is attacked, so he cannot castle kingside.", glow: ["f1", "f8"] },
      { fen: "4k3/8/8/8/8/8/8/R2QK2R w KQ - 0 1", caption: "The queen is in the way, so he cannot castle queenside.", glow: ["d1"] },
    ],
    drills: [
      { fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", goal: { kind: "move", any: [["e1", "g1"], ["e1", "c1"]] }, task: "Castle by moving the king two squares." },
      { fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", goal: { kind: "move", any: [["e1", "c1"]] }, task: "Now castle the long way, towards the queen's side." },
    ],
  },
  {
    id: "enpassant",
    chapter: "Special moves",
    title: "En passant",
    text: "A pawn cannot normally capture a piece beside it. But if an enemy pawn jumps two squares from its start and lands right next to your pawn, you may still capture it, as if it had moved only one square. You can only do it on the very next move.",
    done: "That is en passant, which means capturing in passing.",
    examples: [
      { fen: "4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1", caption: "Black's pawn is still on its starting square.", glow: ["d7"] },
      { fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", caption: "It jumps two squares and lands beside your pawn.", glow: ["d5"] },
      { fen: "4k3/8/3P4/8/8/8/8/4K3 b - - 0 1", caption: "You capture it as if it had moved only one square.", glow: ["d6"] },
    ],
    drills: [
      { fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", goal: { kind: "move", any: [["e5", "d6"]] }, task: "The black pawn just jumped. Capture it as it passes." },
      { fen: "4k3/8/8/4Pp2/8/8/8/4K3 w - f6 0 1", goal: { kind: "move", any: [["e5", "f6"]] }, task: "Do it again, this time on the other side." },
    ],
  },
  {
    id: "promote",
    chapter: "Special moves",
    title: "Promotion",
    text: "When a pawn reaches the far end of the board, it must be promoted. It turns into a queen, a rook, a bishop or a knight, whichever you choose. Almost everyone picks a queen, because she is the strongest piece. That is why a pawn close to the end is so dangerous.",
    done: "Well done. Your pawn has been promoted.",
    examples: [
      { fen: "7k/4P3/8/8/8/8/8/4K3 w - - 0 1", caption: "This pawn is one step from the end.", glow: ["e8"] },
      { fen: "4Q2k/8/8/8/8/8/8/4K3 b - - 0 1", caption: "When it gets there, it becomes a queen.", glow: ["e8"] },
    ],
    drills: [
      { fen: "7k/4P3/8/8/8/8/8/4K3 w - - 0 1", goal: { kind: "move", any: [["e7", "e8"]], promotion: "q" }, task: "Move the pawn to the last row and choose a queen." },
      { fen: "3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1", goal: { kind: "move", any: [["e7", "e8"], ["e7", "d8"]], promotion: "q" }, task: "Promote to a queen, straight ahead or by capturing the rook." },
      { fen: "8/5P1k/8/8/8/8/8/4K3 w - - 0 1", goal: { kind: "move", any: [["f7", "f8"]], promotion: "n" }, task: "Sometimes a knight is better. Promote to a knight and give check." },
    ],
  },
  {
    id: "check",
    chapter: "Check and checkmate",
    title: "Check",
    text: "When a king is attacked, it is in check, and you must deal with it on your very next move. There are three ways to do it. You can move the king, block the attack, or capture the attacker.",
    done: "Well done. Your king is out of check.",
    drills: [
      { fen: "4k3/8/8/8/8/8/8/r3K3 w - - 0 1", goal: { kind: "any" }, task: "A rook is attacking your king. Move your king to safety." },
      { fen: "4k3/8/8/8/8/3n4/8/4K3 w - - 0 1", goal: { kind: "any" }, task: "A knight is attacking your king. Get out of check." },
      { fen: "4k3/8/8/8/8/8/3p4/4K3 w - - 0 1", goal: { kind: "any" }, task: "A pawn is attacking your king. Get out of check." },
    ],
  },
  {
    id: "legal",
    chapter: "Check and checkmate",
    title: "Never leave your king in check",
    text: "You may never make a move that leaves your own king attacked. A piece standing between your king and an enemy attacker is pinned, which means it cannot move away. The king can also never capture a piece that is protected. Do not worry, because the board only lets you make legal moves.",
    done: "Well done. Your king always comes first.",
    examples: [
      { fen: "4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1", caption: "This bishop is pinned, so it cannot move.", glow: ["e2", "e1", "e8"] },
      { fen: "4k3/8/8/8/8/3q4/3p4/4K3 w - - 0 1", caption: "The king cannot take on d2, because the queen guards it.", glow: ["d2", "d3"] },
    ],
    drills: [
      {
        fen: "4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1",
        goal: { kind: "move", any: [["e1", "d1"], ["e1", "f1"], ["e1", "d2"], ["e1", "f2"]] },
        task: "Your bishop is pinned, so it cannot move. Move your king instead.",
        plain: true,
      },
      {
        fen: "4k3/8/8/8/8/3q4/3p4/4K3 w - - 0 1",
        goal: { kind: "move", any: [["e1", "d1"], ["e1", "f2"]] },
        task: "A pawn gives check, but the queen guards it, so you cannot capture it. Escape with your king.",
        plain: true,
      },
    ],
  },
  {
    id: "block",
    chapter: "Check and checkmate",
    title: "Block the check",
    text: "You can put one of your pieces between the attacker and your king. A check from a knight or a pawn cannot be blocked, because the knight jumps and the pawn is right next to the king.",
    done: "Well done. You blocked the check, and your king is safe.",
    drills: [
      { fen: "4k3/8/8/8/8/8/3B4/r3K3 w - - 0 1", goal: { kind: "move", any: [["d2", "c1"]] }, task: "Block the rook with your bishop." },
      { fen: "4k3/8/8/8/8/3N4/8/r3K3 w - - 0 1", goal: { kind: "move", any: [["d3", "c1"]] }, task: "Block the rook with your knight." },
    ],
  },
  {
    id: "capture-checker",
    chapter: "Check and checkmate",
    title: "Capture the attacker",
    text: "Sometimes you can simply take the piece that gives check.",
    done: "Well done. The check is gone, and you won a piece.",
    drills: [
      { fen: "4k3/8/8/8/8/8/3q4/3RK3 w - - 0 1", goal: { kind: "move", any: [["d1", "d2"], ["e1", "d2"]] }, task: "Capture the checking queen." },
      { fen: "4k3/8/8/7B/8/5n2/8/4K3 w - - 0 1", goal: { kind: "move", any: [["h5", "f3"]] }, task: "Capture the checking knight with your bishop." },
    ],
  },
  {
    id: "mate",
    chapter: "Check and checkmate",
    title: "Checkmate",
    text: "If a king is in check and cannot escape by moving, blocking or capturing, it is checkmate. The game is over, and the side giving checkmate wins. Here are three famous checkmates.",
    done: "Checkmate! The king has nowhere to go.",
    examples: [
      { fen: "R5k1/5ppp/8/8/8/8/8/4K3 b - - 0 1", caption: "This is a back-rank mate.", glow: ["g8"] },
      { fen: "7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", caption: "This is a checkmate with the queen.", glow: ["h8"] },
      { fen: "6rk/5Npp/8/8/8/8/8/K7 b - - 0 1", caption: "This is a smothered mate.", glow: ["h8"] },
    ],
    drills: [
      { fen: "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", goal: { kind: "mate" }, task: "Checkmate in one move. The king is trapped behind his own pawns." },
      { fen: "k7/pp6/8/8/8/8/8/4K2R w - - 0 1", goal: { kind: "mate" }, task: "Checkmate in one move." },
      { fen: "6rk/6pp/8/6N1/8/8/8/K7 w - - 0 1", goal: { kind: "mate" }, task: "Checkmate in one move. The king is boxed in by his own pieces." },
    ],
  },
  {
    id: "stalemate",
    chapter: "Check and checkmate",
    title: "Stalemate",
    text: "If a player has no legal move but is not in check, it is called stalemate, and the game is a draw. Nobody wins, so be careful not to let it happen when you are winning.",
    done: "Well done. You found the checkmate and avoided stalemate.",
    examples: [
      { fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", caption: "The king is boxed in, but it is not in check.", glow: ["h8"] },
      { fen: "k7/8/1QK5/8/8/8/8/8 b - - 0 1", caption: "The king is stuck in the corner, but it is not in check.", glow: ["a8"] },
      { fen: "k7/P7/K7/8/8/8/8/8 b - - 0 1", caption: "The king cannot move, and it is not in check.", glow: ["a8"] },
    ],
    drills: [
      {
        fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1",
        goal: { kind: "mate" },
        task: "Checkmate in one move, but be careful, because one tempting move is stalemate.",
        traps: [{ from: "f1", to: "f7", say: "That is stalemate. Black has no move but is not in check, so the game is a draw. Try again." }],
      },
      {
        fen: "k7/8/2K5/8/8/8/8/1Q6 w - - 0 1",
        goal: { kind: "mate" },
        task: "Checkmate again, and watch out for stalemate.",
        traps: [{ from: "b1", to: "b6", say: "That is stalemate again. The king has no safe square but is not in check, so it is a draw. Try again." }],
      },
    ],
  },
  {
    id: "draws",
    chapter: "Check and checkmate",
    title: "Draws",
    text: "A draw means nobody wins. It happens by agreement, by stalemate, when the same position appears three times, after fifty moves without a capture or a pawn move, or when neither side has enough pieces left to give checkmate.",
    examples: [
      { fen: "8/8/8/4k3/8/8/4K3/8 w - - 0 1", caption: "Two kings on their own cannot checkmate." },
      { fen: "8/8/8/4k3/8/8/4KN2/8 w - - 0 1", caption: "A king and a knight cannot checkmate." },
      { fen: "8/8/8/4k3/8/8/4KB2/8 w - - 0 1", caption: "A king and a bishop cannot checkmate." },
    ],
    fen: "8/8/8/4k3/8/8/4K3/8 w - - 0 1",
  },
  {
    id: "mate-rook",
    chapter: "Your first checkmates",
    title: "Mate with a rook",
    text: "A king on the edge of the board is easy to trap. The rook checks along the edge while your king covers the squares next to it.",
    done: "Well done. That is how games are won.",
    drills: [
      { fen: "7k/8/6K1/8/8/8/8/R7 w - - 0 1", goal: { kind: "mate" }, task: "Checkmate in one move." },
      { fen: "k7/8/1K6/8/8/8/8/7R w - - 0 1", goal: { kind: "mate" }, task: "Checkmate in one move, in the other corner." },
    ],
  },
  {
    id: "mate-queen",
    chapter: "Your first checkmates",
    title: "Mate with a queen",
    text: "A queen right next to the enemy king is checkmate when your own king guards her.",
    done: "Well done. The queen and the king work as a team.",
    drills: [
      { fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1", goal: { kind: "mate" }, task: "Checkmate in one move." },
      { fen: "k7/8/1K6/8/8/8/8/7Q w - - 0 1", goal: { kind: "mate" }, task: "Checkmate in one move. Bring the queen right next to the king." },
    ],
  },
  {
    id: "mate-ladder",
    chapter: "Your first checkmates",
    title: "The ladder mate",
    text: "Two rooks can checkmate on their own. One rook cuts off a row while the other gives check on the next one, step by step, like climbing a ladder.",
    done: "That is the ladder mate, and you will use it all the time.",
    drills: [
      { fen: "7k/R7/8/8/8/8/8/1R2K3 w - - 0 1", goal: { kind: "mate" }, task: "Checkmate in one move." },
      { fen: "6k1/R7/8/8/8/8/8/1R2K3 w - - 0 1", goal: { kind: "mate" }, task: "Checkmate in one move." },
    ],
  },
  {
    id: "scholar",
    chapter: "Your first checkmates",
    title: "The Scholar's mate",
    text: "This is a famous trap that catches many beginners. The queen and the bishop both aim at the weak square f7, which only the king protects. It can be checkmate in just four moves, so learn how to play it and, even more importantly, how to stop it.",
    done: "Now you know both sides of the trap.",
    examples: [
      { fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3", caption: "The queen and the bishop both aim at f7.", glow: ["h5", "c4", "f7"] },
      { fen: "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4", caption: "The queen takes on f7, and it is checkmate.", glow: ["f7", "e8"] },
    ],
    drills: [
      {
        fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
        goal: { kind: "move", any: [["g7", "g6"], ["d8", "e7"], ["g8", "h6"], ["d8", "f6"]] },
        task: "You are Black, and the queen threatens to take on f7 with checkmate. Protect the f7 pawn or attack the queen.",
        plain: true,
        traps: [{ from: "g8", to: "f6", say: "That does not stop it, because the queen can still take on f7 with checkmate. The f7 pawn needs protecting. Try again." }],
      },
      {
        fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
        goal: { kind: "mate" },
        task: "Black did not see the threat. Checkmate in one move.",
      },
    ],
  },
  {
    id: "center",
    chapter: "Playing well",
    title: "Take the centre",
    text: "Pawns and pieces in the middle of the board control more squares. A good way to start the game is to move a centre pawn.",
    done: "Well done. Now your pieces have room to come out.",
    drills: [
      { fen: START, goal: { kind: "move", any: [["e2", "e4"], ["d2", "d4"]] }, task: "Play a centre pawn two squares." },
      {
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        goal: { kind: "move", any: [["d2", "d4"], ["g1", "f3"], ["b1", "c3"]] },
        task: "Black copied you. Fight for the centre again.",
      },
    ],
  },
  {
    id: "develop",
    chapter: "Playing well",
    title: "Bring out your pieces",
    text: "Early in the game, move your knights and bishops off the back row towards the centre. Try not to move the same piece twice without a good reason.",
    done: "Well done. More pieces in play means more power.",
    drills: [
      {
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        goal: { kind: "move", any: [["g1", "f3"], ["f1", "c4"]] },
        task: "Bring out a knight or a bishop.",
      },
      {
        fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        goal: { kind: "move", any: [["f1", "c4"], ["f1", "b5"], ["b1", "c3"]] },
        task: "Bring out another piece.",
      },
    ],
  },
  {
    id: "castle-early",
    chapter: "Playing well",
    title: "Castle early",
    text: "Once your knight and bishop are out, castle to get your king to safety.",
    done: "Well played. Your king is safe.",
    drills: [
      { fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", goal: { kind: "move", any: [["e1", "g1"]] }, task: "Castle kingside." },
      { fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5", goal: { kind: "move", any: [["e1", "g1"]] }, task: "Castle again in this position." },
    ],
  },
  {
    id: "opening",
    chapter: "Playing well",
    title: "A good opening",
    text: "In the first few moves, fight for the centre, bring out your knights and bishops, castle, and connect your rooks. Try not to move the same piece twice or make too many pawn moves, and keep your queen at home early on.",
    examples: [{ fen: "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 4 6", caption: "In this position, White's pieces are well developed.", glow: ["f3", "c4", "g1", "f1", "e4", "d3"] }],
    fen: "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 4 6",
  },
  {
    id: "before-move",
    chapter: "Playing well",
    title: "Before every move",
    text: "Most games between beginners are decided by one careless move. Before you move, ask yourself four questions. What did my opponent just do? Is any of my pieces under attack? Can I check, capture or threaten something? Is my move safe? It only takes a few seconds, and it saves games.",
    fen: START,
  },
  {
    id: "endgame",
    chapter: "Playing well",
    title: "The endgame",
    text: "When only a few pieces are left, the king becomes a fighter, so bring him towards the centre. Push your passed pawns, which are pawns with no enemy pawn in front of them or beside them, so they can promote. Rooks belong behind passed pawns.",
    done: "Well done. Endgames are won with the king and the pawns.",
    examples: [
      { fen: "6k1/8/8/3P4/8/8/6PP/6K1 w - - 0 1", caption: "No enemy pawn can stop this passed pawn.", glow: ["d5", "d6", "d7", "d8"] },
      { fen: "8/8/8/4k3/8/3K4/8/8 w - - 0 1", caption: "In the endgame, both kings belong in the centre.", glow: ["e5", "d3"] },
      { fen: "6k1/8/8/3P4/8/8/8/3R2K1 w - - 0 1", caption: "The rook stands behind the passed pawn.", glow: ["d1", "d5"] },
    ],
    drills: [
      { fen: "6k1/8/8/3P4/8/8/6PP/6K1 w - - 0 1", goal: { kind: "move", any: [["d5", "d6"]] }, task: "Push the passed pawn." },
      { fen: "8/8/4k3/8/8/8/PP4PP/6K1 w - - 0 1", goal: { kind: "move", any: [["g1", "f2"]] }, task: "Bring your king towards the middle." },
    ],
  },
  {
    id: "notation",
    chapter: "Good to know",
    title: "Writing moves down",
    text: "Each move is written with a letter for the piece and then the square it lands on. K is the king, Q the queen, R a rook, B a bishop and N a knight, and a pawn has no letter. So Nf3 means a knight moves to f3, and e4 means a pawn moves to e4. An x means a capture, a plus means check, a hash means checkmate, and O-O means castling.",
    done: "Well done. Now you can read a move.",
    drills: [
      { fen: START, goal: { kind: "move", any: [["g1", "f3"]] }, task: "Play the move Nf3.", plain: true },
      { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", goal: { kind: "move", any: [["b8", "c6"]] }, task: "You are Black. Play the move Nc6.", plain: true },
      { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", goal: { kind: "move", any: [["f1", "c4"]] }, task: "Play the move Bc4.", plain: true },
    ],
  },
  {
    id: "rules",
    chapter: "Good to know",
    title: "Other rules",
    text: "In a real game, if you touch one of your pieces you must move it, and you may not take a move back. If a player is clearly lost, they may resign. You can offer a draw, and your opponent may accept it. When you play with a clock, running out of time loses the game. Be polite, and shake hands at the end.",
    fen: START,
  },
  {
    id: "ready",
    chapter: "Playing well",
    title: "You are ready",
    text: "That is every rule you need to know. The rest comes with practice, so play a game and then look back over it.",
    fen: START,
    final: true,
  },
];


/** The position a lesson shows before any practice. */
export function lessonFen(lesson: BasicsLesson): string {
  return lesson.drills?.[0]?.fen ?? lesson.fen ?? START;
}

/** The squares a practice asks you to move to, shown as stars. */
export function targetsOf(drill: Drill): string[] {
  return drill.goal.kind === "move" && !drill.plain ? [...new Set(drill.goal.any.map(([, to]) => to))] : [];
}

/** Where the piece being taught can go: every legal move of that piece, to draw as arrows. */
export function teachingMoves(drill: Drill): { from: string; to: string }[] {
  if (drill.plain) return [];
  try {
    const chess = new Chess(drill.fen);
    let from: string | undefined;
    if (drill.goal.kind === "move") from = drill.goal.any[0][0];
    else if (drill.goal.kind === "any") from = chess.findPiece({ type: "k", color: chess.turn() })[0];
    if (!from) return [];
    return chess.moves({ square: from as never, verbose: true }).map((m) => ({ from: m.from, to: m.to }));
  } catch {
    return [];
  }
}

/** What the coach says when a lesson opens: the idea, then (for examples) what each one shows. */
export function introSpeech(lesson: BasicsLesson): string {
  return [lesson.title + ".", lesson.text, ...(lesson.examples ?? []).map((e) => e.caption)].join(" ");
}

/** What the coach says once a lesson's practice is finished: well done, then the tip for using the piece well. */
export function finishSpeech(lesson: BasicsLesson): string {
  return [lesson.done, lesson.tip ? `A tip. ${lesson.tip.text}` : "", lesson.tip?.example?.caption].filter(Boolean).join(" ");
}

/** Does the move (UCI, e.g. "e2e4") complete the practice? */
export function completes(drill: Drill, uci: string): boolean {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  switch (drill.goal.kind) {
    case "square":
      return false;
    case "any":
      return true;
    case "move":
      return drill.goal.any.some(([f, t]) => f === from && t === to) && (!drill.goal.promotion || uci[4] === drill.goal.promotion);
    case "mate": {
      try {
        const chess = new Chess(drill.fen);
        chess.move({ from, to, promotion: uci[4] });
        return chess.isCheckmate();
      } catch {
        return false;
      }
    }
  }
}

/** Does tapping this square complete a "tap the square" practice? */
export function tapCompletes(drill: Drill, square: string): boolean {
  return drill.goal.kind === "square" && drill.goal.square === square;
}

/** The squares where a kind of piece stands at the start, for both colours. */
export function startSquaresOf(piece: "K" | "Q" | "R" | "B" | "N" | "P"): string[] {
  const chess = new Chess(START);
  return chess.findPiece({ type: piece.toLowerCase() as never, color: "w" }).concat(chess.findPiece({ type: piece.toLowerCase() as never, color: "b" }));
}

/** The lesson a tempting move teaches, if this is one of the practice's traps. */
export function trapFor(drill: Drill, uci: string): string | null {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  return drill.traps?.find((t) => t.from === from && t.to === to)?.say ?? null;
}

/** The position after a move (UCI) from a position, plus the squares it touched and its notation. */
export function afterMove(fen: string, uci: string): { fen: string; from: string; to: string; san: string } | null {
  try {
    const chess = new Chess(fen);
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return { fen: chess.fen(), from: m.from, to: m.to, san: m.san };
  } catch {
    return null;
  }
}
