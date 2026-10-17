import { Chess, validateFen } from "chess.js";

/** Square → piece code ("wK", "bP", …). */
export type Placement = Record<string, string>;

export interface Castling {
  K: boolean;
  Q: boolean;
  k: boolean;
  q: boolean;
}

const FILES = "abcdefgh";
export const START_PLACEMENT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

/** Parse the board part of a FEN (also accepts a full FEN). */
export function placementFromFen(fen: string): Placement {
  const rows = fen.trim().split(/\s+/)[0].split("/");
  const out: Placement = {};
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        if (f < 8 && r < 8) out[`${FILES[f]}${8 - r}`] = (ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase();
        f++;
      }
    }
  });
  return out;
}

export function placementToFen(p: Placement): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (const file of FILES) {
      const code = p[`${file}${rank}`];
      if (!code) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      row += code[0] === "w" ? code[1] : code[1].toLowerCase();
    }
    rows.push(row + (empty ? empty : ""));
  }
  return rows.join("/");
}

/** Castling rights that are possible given where the kings and rooks stand. */
export function possibleCastling(p: Placement): Castling {
  return {
    K: p.e1 === "wK" && p.h1 === "wR",
    Q: p.e1 === "wK" && p.a1 === "wR",
    k: p.e8 === "bK" && p.h8 === "bR",
    q: p.e8 === "bK" && p.a8 === "bR",
  };
}

export function buildFen(p: Placement, turn: "w" | "b", castling: Castling): string {
  const ok = possibleCastling(p);
  const rights = (["K", "Q", "k", "q"] as const).filter((k) => castling[k] && ok[k]).join("") || "-";
  return `${placementToFen(p)} ${turn} ${rights} - 0 1`;
}

/** Returns a reason the position can't be played, or null when it is fine. */
export function setupProblem(fen: string): string | null {
  const p = placementFromFen(fen);
  const codes = Object.values(p);
  const count = (c: string) => codes.filter((x) => x === c).length;
  if (count("wK") !== 1) return count("wK") === 0 ? "White needs a king." : "White can only have one king.";
  if (count("bK") !== 1) return count("bK") === 0 ? "Black needs a king." : "Black can only have one king.";
  if (Object.entries(p).some(([sq, c]) => c[1] === "P" && (sq[1] === "1" || sq[1] === "8"))) return "Pawns can't stand on the first or last rank.";
  if (count("wP") > 8 || count("bP") > 8) return "A side can't have more than 8 pawns.";
  const check = validateFen(fen);
  if (!check.ok) return check.error ?? "Invalid position.";
  // The side that just moved can't be left in check.
  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  try {
    if (new Chess(parts.join(" ")).inCheck()) return `${parts[1] === "w" ? "White" : "Black"} is in check but it isn't their move.`;
  } catch {
    return "Invalid position.";
  }
  return null;
}
