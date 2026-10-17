/**
 * Play-vs-Stockfish opponents, ordered from weakest to strongest.
 *
 * Levels 4–9 use UCI_LimitStrength with a target Elo (Stockfish's own
 * calibration, CCRL-like scale; minimum 1320). Stockfish never plays like a
 * real beginner through its options alone (even shallow searches rarely hang
 * pieces), so levels 1–3 use `humanize`: Tempo picks randomly among the
 * engine's top-K moves and sometimes plays a uniformly random legal move.
 * Their ratings are rough estimates (shown with "≈"), not calibrations.
 * Level 10 is full strength.
 *
 * Avatars: DiceBear "Notionists" (CC0-1.0), stored in public/bots/.
 */
export interface PlayLevel {
  level: number;
  name: string;
  avatar: string;
  /** Strength shown on the card. */
  rating: string;
  label: string;
  strength: { skillLevel?: number; elo?: number };
  /** Optional search-depth cap (used for the weakest bots). */
  depth?: number;
  /** Beginner behaviour: random-move chance and top-K choice. */
  humanize?: { randomMoveRate: number; topK: number };
  movetimeMs: number;
}

/** Bump when avatar files change so browsers fetch the new images. */
const AVATAR_VERSION = 2;
const avatar = (id: string) => `/bots/${id}.svg?v=${AVATAR_VERSION}`;

export const PLAY_LEVELS: PlayLevel[] = [
  { level: 1, name: "Ali", avatar: avatar("ali"), rating: "≈400", label: "Beginner (≈400)", strength: {}, depth: 2, humanize: { randomMoveRate: 0.4, topK: 8 }, movetimeMs: 300 },
  { level: 2, name: "Sara", avatar: avatar("sara"), rating: "≈700", label: "Novice (≈700)", strength: {}, depth: 3, humanize: { randomMoveRate: 0.2, topK: 5 }, movetimeMs: 300 },
  { level: 3, name: "Omar", avatar: avatar("omar"), rating: "≈1000", label: "Casual (≈1000)", strength: {}, depth: 4, humanize: { randomMoveRate: 0.08, topK: 3 }, movetimeMs: 400 },
  { level: 4, name: "Aisha", avatar: avatar("aisha"), rating: "1400", label: "Club (1400)", strength: { elo: 1400 }, movetimeMs: 500 },
  { level: 5, name: "Bilal", avatar: avatar("bilal"), rating: "1600", label: "Club (1600)", strength: { elo: 1600 }, movetimeMs: 500 },
  { level: 6, name: "Zainab", avatar: avatar("zainab"), rating: "1800", label: "Strong club (1800)", strength: { elo: 1800 }, movetimeMs: 700 },
  { level: 7, name: "Yusuf", avatar: avatar("yusuf"), rating: "2000", label: "Expert (2000)", strength: { elo: 2000 }, movetimeMs: 800 },
  { level: 8, name: "Maryam", avatar: avatar("maryam"), rating: "2300", label: "Master (2300)", strength: { elo: 2300 }, movetimeMs: 1000 },
  { level: 9, name: "Hamza", avatar: avatar("hamza"), rating: "2600", label: "Grandmaster (2600)", strength: { elo: 2600 }, movetimeMs: 1200 },
  { level: 10, name: "Stockfish", avatar: avatar("stockfish"), rating: "Max", label: "Full strength", strength: {}, movetimeMs: 1500 },
];

/**
 * Choose a "human" move for beginner bots: with probability randomMoveRate a
 * uniformly random legal move, otherwise a random pick among the engine's
 * top-K candidate moves. Always returns a legal move when one exists.
 */
export function pickHumanMove(candidates: string[], legal: string[], humanize: { randomMoveRate: number; topK: number }, random = Math.random): string | null {
  if (legal.length === 0) return null;
  if (random() < humanize.randomMoveRate || candidates.length === 0) return legal[Math.floor(random() * legal.length)];
  const pool = candidates.filter((m) => legal.includes(m)).slice(0, humanize.topK);
  if (pool.length === 0) return legal[Math.floor(random() * legal.length)];
  return pool[Math.floor(random() * pool.length)];
}
