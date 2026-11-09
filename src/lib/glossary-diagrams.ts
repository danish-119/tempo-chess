/** A picture for the glossary terms that are easiest to see: a position, and the squares to light up. */
export interface GlossaryDiagram {
  fen: string;
  glow: readonly string[];
}

const FILE_E = ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"];

export const GLOSSARY_DIAGRAMS: Record<string, GlossaryDiagram> = {
  check: { fen: "4k3/8/8/8/8/8/4R3/4K3 b - - 0 1", glow: ["e8", "e2"] },
  checkmate: { fen: "R5k1/5ppp/8/8/8/8/8/4K3 b - - 0 1", glow: ["g8", "a8"] },
  stalemate: { fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", glow: ["h8"] },
  castling: { fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", glow: ["g1", "f1"] },
  "en-passant": { fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", glow: ["d6"] },
  promotion: { fen: "7k/4P3/8/8/8/8/8/4K3 w - - 0 1", glow: ["e8"] },
  fork: { fen: "8/8/2k1q3/8/3N4/8/8/6K1 w - - 0 1", glow: ["c6", "e6"] },
  pin: { fen: "4k3/8/8/8/1b6/8/3N4/4K3 w - - 0 1", glow: ["d2", "e1"] },
  skewer: { fen: "4k3/4q3/8/8/8/8/8/4R1K1 w - - 0 1", glow: ["e7", "e8"] },
  "back-rank": { fen: "R5k1/5ppp/8/8/8/8/8/4K3 b - - 0 1", glow: ["g8", "f7", "g7", "h7"] },
  "smothered-mate": { fen: "6rk/5Npp/8/8/8/8/8/K7 b - - 0 1", glow: ["h8", "f7"] },
  "hanging-piece": { fen: "4k3/8/8/3n4/8/8/3Q4/4K3 w - - 0 1", glow: ["d5"] },
  "open-file": { fen: "6k1/pp3ppp/8/8/8/8/PP3PPP/4R1K1 w - - 0 1", glow: FILE_E },
  "seventh-rank": { fen: "6k1/R4ppp/8/8/8/8/8/6K1 w - - 0 1", glow: ["a7"] },
  "passed-pawn": { fen: "6k1/8/8/3P4/8/8/6PP/6K1 w - - 0 1", glow: ["d5", "d6", "d7", "d8"] },
  "isolated-pawn": { fen: "6k1/pp3ppp/8/8/3P4/8/PP3PPP/6K1 w - - 0 1", glow: ["d4"] },
  "doubled-pawns": { fen: "6k1/8/8/8/4P3/4P3/8/6K1 w - - 0 1", glow: ["e3", "e4"] },
  opposition: { fen: "8/8/8/4k3/8/4K3/8/8 w - - 0 1", glow: ["e3", "e5"] },
  outpost: { fen: "6k1/pp3ppp/8/3N4/4P3/8/PP3PPP/6K1 w - - 0 1", glow: ["d5"] },
  fianchetto: { fen: "rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPPBP/RNBQK1NR b KQkq - 1 2", glow: ["g2"] },
  centre: { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", glow: ["d4", "e4", "d5", "e5"] },
  gambit: { fen: "rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3 0 2", glow: ["f4"] },
  luft: { fen: "6k1/5pp1/7p/8/8/8/8/R5K1 w - - 0 1", glow: ["h6"] },
};
