import { Chess } from "chess.js";

/**
 * Parse typed move text (SAN like "Nf3", "exd5", "O-O", or coordinates like
 * "e2e4" / "e2-e4") against `fen`. Returns the UCI move, or null if it is not
 * a legal move in that position.
 */
export function parseMoveInput(fen: string, input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  const compact = raw.replace(/\s+/g, "");
  // Lower-case piece letters ("nf3") are tried last: "bxc3" is a pawn capture first, a bishop second.
  const capitalised = compact.replace(/^[nbrqk]/, (c) => c.toUpperCase());
  const attempts = [raw, raw.replace(/0/g, "O"), compact, capitalised];
  for (const a of attempts) {
    const coords = /^([a-h][1-8])[-x]?([a-h][1-8])([qrbn])?$/i.exec(a.replace(/\s+/g, ""));
    try {
      if (coords) {
        const m = chess.move({ from: coords[1].toLowerCase(), to: coords[2].toLowerCase(), promotion: coords[3]?.toLowerCase() });
        return `${m.from}${m.to}${m.promotion ?? ""}`;
      }
      const m = chess.move(a, { strict: false });
      return `${m.from}${m.to}${m.promotion ?? ""}`;
    } catch {
      /* try the next spelling */
    }
  }
  return null;
}

const NAMES: Record<string, string> = { k: "King", q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn" };
const ORDER = ["k", "q", "r", "b", "n", "p"] as const;

/** Text list of where every piece is, e.g. "King e1; Queen d1; …". Used by "Peek as text". */
export function piecePlacementText(fen: string): { white: string; black: string } {
  const chess = new Chess(fen);
  const out: Record<"w" | "b", string[]> = { w: [], b: [] };
  const squares = new Map<string, string[]>();
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      const key = `${cell.color}${cell.type}`;
      squares.set(key, [...(squares.get(key) ?? []), cell.square]);
    }
  }
  for (const color of ["w", "b"] as const) {
    for (const t of ORDER) {
      const sq = squares.get(`${color}${t}`);
      if (sq?.length) out[color].push(`${NAMES[t]}${sq.length > 1 ? "s" : ""} ${[...sq].sort().join(", ")}`);
    }
  }
  return { white: out.w.join("; "), black: out.b.join("; ") };
}
