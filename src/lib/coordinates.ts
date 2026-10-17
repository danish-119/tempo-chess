/**
 * Coordinate trainer: learn square names.
 *  - find:  a square is named, click it on the board;
 *  - name:  a square is highlighted, pick its name;
 *  - color: a square is named, say whether it is light or dark (no board).
 */
export type CoordMode = "find" | "name" | "color";
/** Round length in seconds; null = untimed practice. */
export type CoordTime = 30 | 60 | 120 | null;

export const COORD_MODES: { id: CoordMode; label: string; hint: string }[] = [
  { id: "find", label: "Find the square", hint: "Click the square that is named." },
  { id: "name", label: "Name the square", hint: "Pick the name of the highlighted square." },
  { id: "color", label: "Light or dark", hint: "Say the square's colour without looking at the board." },
];
export const COORD_TIMES: { id: CoordTime; label: string }[] = [
  { id: 30, label: "30s" },
  { id: 60, label: "1 min" },
  { id: 120, label: "2 min" },
  { id: null, label: "No timer" },
];

const FILES = "abcdefgh";

/** A random square different from `previous`. */
export function randomSquare(previous: string | null, random = Math.random): string {
  for (;;) {
    const sq = `${FILES[Math.floor(random() * 8)]}${1 + Math.floor(random() * 8)}`;
    if (sq !== previous) return sq;
  }
}

/** a1 is dark; squares alternate. */
export function isLightSquare(square: string): boolean {
  const f = FILES.indexOf(square[0]);
  const r = Number(square[1]) - 1;
  return (f + r) % 2 === 1;
}

/** Four distinct answer choices including `target`, in random order. Distractors are nearby squares, so it isn't trivial. */
export function nameChoices(target: string, random = Math.random): string[] {
  const f = FILES.indexOf(target[0]);
  const r = Number(target[1]);
  const near: string[] = [];
  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
    const nf = f + df;
    const nr = r + dr;
    if (nf >= 0 && nf < 8 && nr >= 1 && nr <= 8) near.push(`${FILES[nf]}${nr}`);
  }
  const pool = [...near];
  const picks: string[] = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  const all = [target, ...picks];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}
