import { z } from "zod";
import type { GameState, Player } from "./rules";
import { timeLeft } from "./rules";

/** Messages from a client to a game room. Everything is untrusted: size-capped and schema-checked. */
export const MAX_MESSAGE_BYTES = 1024;

export const ClientMessage = z.discriminatedUnion("t", [
  z.object({ t: z.literal("move"), uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/), ply: z.number().int().min(1).max(2000) }),
  z.object({ t: z.literal("resign") }),
  z.object({ t: z.literal("draw"), action: z.enum(["offer", "accept", "decline"]) }),
  z.object({ t: z.literal("cancel") }),
  /** Heartbeat; `lag` is the client's own measure of half its round trip (bounded by the rules, so it cannot be abused). */
  z.object({ t: z.literal("ping"), n: z.number().int().min(0).max(1e9), lag: z.number().min(0).max(10_000).optional() }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export function parseClientMessage(raw: string | ArrayBuffer): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) return null;
  try {
    const parsed = ClientMessage.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const publicPlayer = (p: Player | null) => (p ? { name: p.name, tag: p.tag, image: p.image, guest: !!p.guest } : null);

/** What every client sees: the full game, with clocks as of `now` (server time). */
export function snapshot(state: GameState, now: number, you: "w" | "b" | "spectator", viewerId: string | null) {
  return {
    t: "state" as const,
    code: state.code,
    you,
    /** Whether this viewer made the game (names are not unique, so the client cannot tell). */
    relation: viewerId && state.creator.id === viewerId ? ("creator" as const) : null,
    status: state.status,
    tc: state.tc.id,
    creator: publicPlayer(state.creator),
    players: { w: publicPlayer(state.players.w), b: publicPlayer(state.players.b) },
    fen: state.fen,
    moves: state.moves,
    sans: state.sans,
    clock: state.clock ? { w: timeLeft(state, "w", now), b: timeLeft(state, "b", now) } : null,
    drawOffer: state.drawOffer,
    result: state.result,
    serverTime: now,
  };
}
