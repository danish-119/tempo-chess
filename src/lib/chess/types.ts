export type Color = "w" | "b";

export type PieceSymbol = "p" | "n" | "b" | "r" | "q" | "k";

export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

/** A single half-move of an imported game, fully resolved against the rules. */
export interface PlyRecord {
  /** 1-based ply index within the mainline. */
  ply: number;
  /** Full-move number as it would appear in PGN. */
  moveNumber: number;
  color: Color;
  san: string;
  /** Long algebraic (UCI) notation, e.g. e2e4 or e7e8q. */
  uci: string;
  from: string;
  to: string;
  promotion?: PieceSymbol;
  captured?: PieceSymbol;
  piece: PieceSymbol;
  fenBefore: string;
  fenAfter: string;
  /** Comment attached to this move in the source PGN, if any (plain text). */
  comment?: string;
  /** Remaining clock in seconds parsed from a [%clk] annotation, if present. */
  clockSeconds?: number;
}

export interface GameMetadata {
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  result: GameResult;
  timeControl?: string;
  termination?: string;
  eco?: string;
  openingName?: string;
  link?: string;
  variant?: string;
  /** Rated status when known from the source (Chess.com JSON provides it). */
  rated?: boolean;
  timeClass?: TimeClass;
  /** Accuracy reported by Chess.com's API (only if the game was reviewed there). */
  chessComAccuracy?: { white?: number; black?: number };
}

export type TimeClass = "bullet" | "blitz" | "rapid" | "classical" | "daily";

/** "local" = a free-analysis board whose mainline the user builds by playing moves. */
export type GameSource = "pgn" | "chesscom" | "lichess" | "local";

export interface ImportedGame {
  /** Stable id derived from the PGN content. */
  id: string;
  source: GameSource;
  /** The original PGN text exactly as imported. Never mutated. */
  originalPgn: string;
  headers: Record<string, string>;
  metadata: GameMetadata;
  startFen: string;
  moves: PlyRecord[];
  /** Set when the PGN declared a non-standard start position. */
  customStart: boolean;
  importedAt: number;
}

export type ParseErrorCode =
  | "EMPTY_INPUT"
  | "TOO_LARGE"
  | "TOO_MANY_GAMES"
  | "INVALID_PGN"
  | "ILLEGAL_MOVE"
  | "INVALID_FEN"
  | "UNSUPPORTED_VARIANT";

export class PgnParseError extends Error {
  readonly code: ParseErrorCode;
  /** Index of the game within a multi-game input, if applicable. */
  readonly gameIndex?: number;

  constructor(code: ParseErrorCode, message: string, gameIndex?: number) {
    super(message);
    this.name = "PgnParseError";
    this.code = code;
    this.gameIndex = gameIndex;
  }
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
