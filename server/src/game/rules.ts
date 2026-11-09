import { Chess } from "chess.js";

/**
 * The referee for an online game, as plain functions over plain data so it can be tested without a server.
 *
 * The server is the only source of truth: it checks every move, keeps both clocks from its own timestamps, and
 * decides how the game ends. Clocks follow the usual online rules: the mover's thinking time is measured on the
 * server, the increment is added after the move, and a little network delay is forgiven from a small per-player
 * allowance (so a player on a slow connection is not flagged by lag, but cannot use lag as extra thinking time).
 */
export type Color = "w" | "b";

export interface TimeControl {
  id: string;
  /** null = no clock. */
  baseMs: number | null;
  incrementMs: number;
}

export const TIME_CONTROLS: readonly TimeControl[] = [
  { id: "none", baseMs: null, incrementMs: 0 },
  { id: "1+0", baseMs: 60_000, incrementMs: 0 },
  { id: "3+2", baseMs: 180_000, incrementMs: 2_000 },
  { id: "5+0", baseMs: 300_000, incrementMs: 0 },
  { id: "10+0", baseMs: 600_000, incrementMs: 0 },
  { id: "15+10", baseMs: 900_000, incrementMs: 10_000 },
  { id: "30+0", baseMs: 1_800_000, incrementMs: 0 },
];

export function timeControl(id: string): TimeControl | null {
  return TIME_CONTROLS.find((t) => t.id === id) ?? null;
}

/** At most this much delay is forgiven per move, from an allowance that refills a little with every move. */
export const LAG_PER_MOVE_MS = 500;
export const LAG_QUOTA_MS = 3_000;
const LAG_REFILL_MS = 100;
/** A game where White never makes the first move is called off (not counted). */
export const FIRST_MOVE_MS = 30_000;
/** An invite code nobody uses lapses. */
export const INVITE_TTL_MS = 60 * 60_000;

export type EndReason =
  | "checkmate"
  | "stalemate"
  | "insufficient"
  | "threefold"
  | "fifty-moves"
  | "resign"
  | "timeout"
  | "timeout-insufficient"
  | "agreement"
  | "aborted"
  | "expired";

export interface GameResult {
  /** "1-0", "0-1", "1/2-1/2", or "*" for a game that was called off. */
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  reason: EndReason;
  winner: Color | null;
}

export interface Player {
  id: string;
  /** The display name, or a guest's nickname (not unique). */
  name: string;
  /** The Tempo ID. */
  tag: string | null;
  image: string | null;
  /** Playing without an account. */
  guest?: boolean;
}

export interface GameState {
  code: string;
  tc: TimeControl;
  status: "waiting" | "playing" | "ended";
  /** Who made the game and shared its code. */
  creator: Player;
  players: { w: Player | null; b: Player | null };
  /** The creator's choice before the second player arrives. */
  creatorColor: Color | "random";
  fen: string;
  moves: string[];
  sans: string[];
  /** Remaining time per side at the start of the current turn (ms). */
  clock: { w: number; b: number } | null;
  /** Server time when the current turn started (ms since epoch). */
  turnStartedAt: number | null;
  lagQuota: { w: number; b: number };
  drawOffer: Color | null;
  result: GameResult | null;
  createdAt: number;
  endedAt: number | null;
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const opposite = (c: Color): Color => (c === "w" ? "b" : "w");

export function newGame(code: string, tc: TimeControl, creator: Player, creatorColor: Color | "random", now: number): GameState {
  return {
    code,
    tc,
    status: "waiting",
    creator,
    players: { w: null, b: null },
    creatorColor,
    fen: START_FEN,
    moves: [],
    sans: [],
    clock: tc.baseMs === null ? null : { w: tc.baseMs, b: tc.baseMs },
    turnStartedAt: null,
    lagQuota: { w: LAG_QUOTA_MS, b: LAG_QUOTA_MS },
    drawOffer: null,
    result: null,
    createdAt: now,
    endedAt: null,
  };
}

/** Seat the second player; colours are settled now. Returns the new state, or an error message. */
export function join(state: GameState, guest: Player, now: number, random = Math.random): GameState | string {
  if (state.status !== "waiting") return "This game has already started.";
  const creator = state.creator;
  if (creator.id === guest.id) return "Share the code with a friend; you cannot play yourself.";
  // Colours are drawn when the second player arrives, so "random" is fair to both.
  const creatorColor: Color = state.creatorColor === "random" ? (random() < 0.5 ? "w" : "b") : state.creatorColor;
  const players = creatorColor === "w" ? { w: creator, b: guest } : { w: guest, b: creator };
  return { ...state, players, status: "playing", turnStartedAt: now };
}

export function colorOf(state: GameState, userId: string): Color | null {
  if (state.players.w?.id === userId) return "w";
  if (state.players.b?.id === userId) return "b";
  return null;
}

/** Time left for `side` right now. */
export function timeLeft(state: GameState, side: Color, now: number): number {
  if (!state.clock) return Infinity;
  const turn = sideToMove(state);
  const base = state.clock[side];
  if (state.status !== "playing" || side !== turn || state.turnStartedAt === null) return base;
  // White's clock does not run before the first move.
  if (state.moves.length === 0) return base;
  return Math.max(0, base - (now - state.turnStartedAt));
}

export function sideToMove(state: GameState): Color {
  return state.moves.length % 2 === 0 ? "w" : "b";
}

/** When the side to move will run out of time (or have to move first), for the alarm; null when nothing is pending. */
export function deadline(state: GameState): number | null {
  if (state.status === "waiting") return state.createdAt + INVITE_TTL_MS;
  if (state.status !== "playing" || state.turnStartedAt === null) return null;
  if (state.moves.length === 0) return state.turnStartedAt + FIRST_MOVE_MS;
  if (!state.clock) return null;
  return state.turnStartedAt + state.clock[sideToMove(state)];
}

function end(state: GameState, result: GameResult, now: number): GameState {
  return { ...state, status: "ended", result, drawOffer: null, endedAt: now, turnStartedAt: null };
}

/** Can `side` still give checkmate with the material it has? (Used when the opponent's flag falls.) */
export function canMate(fen: string, side: Color): boolean {
  const pieces = new Chess(fen).board().flat().filter((p) => p && p.color === side && p.type !== "k");
  if (pieces.some((p) => p!.type === "p" || p!.type === "r" || p!.type === "q")) return true;
  const minors = pieces.length;
  return minors >= 2;
}

export type MoveOutcome = { ok: true; state: GameState; san: string } | { ok: false; error: string };

/**
 * Play `uci` for the player `userId`. `lagMs` is the network delay the server measured for that player (half the
 * ping round trip); some of it is forgiven from their allowance.
 */
export function playMove(state: GameState, userId: string, uci: string, now: number, lagMs = 0): MoveOutcome {
  if (state.status !== "playing") return { ok: false, error: "The game is not in progress." };
  const me = colorOf(state, userId);
  if (!me) return { ok: false, error: "You are not playing in this game." };
  if (me !== sideToMove(state)) return { ok: false, error: "It is not your turn." };
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return { ok: false, error: "That is not a move." };

  // Time: measured on the server, minus a little forgiven network delay.
  let clock = state.clock;
  let lagQuota = state.lagQuota;
  if (clock && state.moves.length > 0 && state.turnStartedAt !== null) {
    const forgiven = Math.min(Math.max(0, lagMs), LAG_PER_MOVE_MS, lagQuota[me]);
    const used = Math.max(0, now - state.turnStartedAt - forgiven);
    const left = clock[me] - used;
    if (left <= 0) return { ok: true, state: flag(state, me, now), san: "" };
    lagQuota = { ...lagQuota, [me]: Math.min(LAG_QUOTA_MS, lagQuota[me] - forgiven + LAG_REFILL_MS) };
    clock = { ...clock, [me]: left + state.tc.incrementMs };
  }

  const chess = new Chess(state.fen);
  let move;
  try {
    move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return { ok: false, error: "That move is not legal." };
  }
  const moves = [...state.moves, uci];
  const sans = [...state.sans, move.san];
  let next: GameState = {
    ...state,
    fen: chess.fen(),
    moves,
    sans,
    clock,
    lagQuota,
    turnStartedAt: now,
    // A draw offer lapses once the other player moves instead of answering it.
    drawOffer: state.drawOffer === me ? me : null,
  };

  if (chess.isCheckmate()) next = end(next, { result: me === "w" ? "1-0" : "0-1", reason: "checkmate", winner: me }, now);
  else if (chess.isStalemate()) next = end(next, { result: "1/2-1/2", reason: "stalemate", winner: null }, now);
  else if (chess.isInsufficientMaterial()) next = end(next, { result: "1/2-1/2", reason: "insufficient", winner: null }, now);
  else if (isThreefold(moves)) next = end(next, { result: "1/2-1/2", reason: "threefold", winner: null }, now);
  else if (chess.isDrawByFiftyMoves()) next = end(next, { result: "1/2-1/2", reason: "fifty-moves", winner: null }, now);
  return { ok: true, state: next, san: move.san };
}

/** chess.js only sees repetition within one Chess instance, so replay the game to check it. */
function isThreefold(moves: string[]): boolean {
  const chess = new Chess(START_FEN);
  for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return chess.isThreefoldRepetition();
}

/** The side to move ran out of time: they lose, unless the opponent cannot possibly mate (then it is a draw). */
export function flag(state: GameState, loser: Color, now: number): GameState {
  if (state.status !== "playing") return state;
  const winner = opposite(loser);
  const clock = state.clock ? { ...state.clock, [loser]: 0 } : null;
  if (!canMate(state.fen, winner)) return end({ ...state, clock }, { result: "1/2-1/2", reason: "timeout-insufficient", winner: null }, now);
  return end({ ...state, clock }, { result: winner === "w" ? "1-0" : "0-1", reason: "timeout", winner }, now);
}

/** Called by the alarm: end the game if the side to move is out of time, or never made the first move. */
export function checkTime(state: GameState, now: number): GameState {
  const due = deadline(state);
  if (due === null || now < due) return state;
  if (state.status === "waiting") return end(state, { result: "*", reason: "expired", winner: null }, now);
  if (state.moves.length === 0) return end(state, { result: "*", reason: "aborted", winner: null }, now);
  return flag(state, sideToMove(state), now);
}

export function resign(state: GameState, userId: string, now: number): GameState | string {
  if (state.status !== "playing") return "The game is not in progress.";
  const me = colorOf(state, userId);
  if (!me) return "You are not playing in this game.";
  // Before both players have moved, leaving simply calls the game off.
  if (state.moves.length < 2) return end(state, { result: "*", reason: "aborted", winner: null }, now);
  const winner = opposite(me);
  return end(state, { result: winner === "w" ? "1-0" : "0-1", reason: "resign", winner }, now);
}

export function offerDraw(state: GameState, userId: string, now: number): GameState | string {
  if (state.status !== "playing") return "The game is not in progress.";
  const me = colorOf(state, userId);
  if (!me) return "You are not playing in this game.";
  if (state.drawOffer === opposite(me)) return end(state, { result: "1/2-1/2", reason: "agreement", winner: null }, now);
  return { ...state, drawOffer: me };
}

export function declineDraw(state: GameState, userId: string): GameState | string {
  const me = colorOf(state, userId);
  if (!me || state.drawOffer !== opposite(me)) return "There is no draw offer to decline.";
  return { ...state, drawOffer: null };
}

/** The game as PGN, for saving to both players' libraries. */
export function toPgn(state: GameState, date = new Date(state.createdAt)): string {
  const d = date.toISOString().slice(0, 10).replace(/-/g, ".");
  const tags = [
    ["Event", "Tempo online game"],
    ["Site", "Tempo"],
    ["Date", d],
    ["White", state.players.w?.name ?? "?"],
    ["Black", state.players.b?.name ?? "?"],
    ["Result", state.result?.result ?? "*"],
    ["TimeControl", state.tc.baseMs === null ? "-" : `${state.tc.baseMs / 1000}+${state.tc.incrementMs / 1000}`],
    ["Termination", state.result?.reason ?? "unterminated"],
  ];
  const body = state.sans.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(" ");
  return `${tags.map(([k, v]) => `[${k} "${v.replace(/"/g, "'")}"]`).join("\n")}\n\n${body} ${state.result?.result ?? "*"}\n`;
}

/** The creator calls off a game nobody has joined yet. */
export function cancel(state: GameState, userId: string, now: number): GameState | string {
  if (state.status !== "waiting") return "This game has already started.";
  if (state.creator.id !== userId) return "Only the player who made the game can cancel it.";
  return end(state, { result: "*", reason: "aborted", winner: null }, now);
}
