/** Board colour themes (Tempo's own palettes). */
export const BOARD_THEMES = [
  { id: "slate", label: "Slate", light: "#e4e8ed", dark: "#8295ab" },
  { id: "walnut", label: "Walnut", light: "#efdcbc", dark: "#a97c55" },
  { id: "sage", label: "Sage", light: "#e7ebd6", dark: "#7f9a6e" },
  { id: "ocean", label: "Ocean", light: "#dbe9f1", dark: "#5d8aa8" },
  { id: "plum", label: "Plum", light: "#ece2ee", dark: "#8f6f98" },
  { id: "sand", label: "Sand", light: "#f3ead8", dark: "#c9a874" },
  { id: "graphite", label: "Graphite", light: "#d6d6d6", dark: "#6e6e6e" },
  { id: "coral", label: "Coral", light: "#f4e1d8", dark: "#c27c66" },
] as const;

export type BoardThemeId = (typeof BOARD_THEMES)[number]["id"];

/**
 * Piece sets. "classic" is the set bundled with react-chessboard (MIT); the
 * others are served from /pieces/<id>/ and come from the Lichess piece
 * collection under the licenses listed (all GPL-3.0 compatible).
 */
export const PIECE_SETS = [
  { id: "classic", label: "Classic", license: "MIT (react-chessboard)" },
  { id: "cburnett", label: "Cburnett", license: "GPL-2.0+ — Colin M.L. Burnett" },
  { id: "merida", label: "Merida", license: "GPL-2.0+ — Armando Hernandez Marroquin" },
  { id: "chessnut", label: "Chessnut", license: "Apache-2.0 — Alexis Luengas" },
  { id: "fantasy", label: "Fantasy", license: "MIT — Maurizio Monge" },
  { id: "spatial", label: "Spatial", license: "MIT — Maurizio Monge" },
  { id: "celtic", label: "Celtic", license: "MIT — Maurizio Monge" },
  { id: "rhosgfx", label: "Rhosgfx", license: "CC0-1.0 — RhosGFX" },
  { id: "mpchess", label: "MPChess", license: "GPL-3.0+ — Maxime Chupin" },
  { id: "pixel", label: "Pixel", license: "AGPL-3.0+ — therealqtpi" },
] as const;

export type PieceSetId = (typeof PIECE_SETS)[number]["id"];

export const PIECE_CODES = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"] as const;

export function boardTheme(id: string) {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}

export function pieceUrl(set: string, code: string): string {
  return `/pieces/${set}/${code}.svg`;
}

