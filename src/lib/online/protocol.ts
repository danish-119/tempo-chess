import { Chess } from "chess.js";
import { z } from "zod";
import { applyUci } from "@/lib/chess/line";

/**
 * Messages exchanged over the peer-to-peer data channel. Everything arriving
 * from the other player is untrusted: it is size-limited, schema-checked and
 * every move is validated against the local game before it is applied.
 */
export const MAX_MESSAGE_BYTES = 512;

const UCI = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);

export const MessageSchema = z.discriminatedUnion("t", [
  /** Host → guest: the game begins; the guest plays `guestColor`. */
  z.object({ t: z.literal("start"), guestColor: z.enum(["w", "b"]), game: z.number().int().min(1).max(1000), tc: z.string().max(10).default("none") }),
  /** A move; `ply` is the number of plies on the board after it (detects desync). */
  z.object({ t: z.literal("move"), uci: UCI, ply: z.number().int().min(1).max(1000), ms: z.number().int().min(0).max(100_000_000).optional() }),
  /** The sender ran out of time and loses. */
  z.object({ t: z.literal("flag") }),
  z.object({ t: z.literal("resign") }),
  z.object({ t: z.literal("draw"), action: z.enum(["offer", "accept", "decline"]) }),
  z.object({ t: z.literal("rematch"), action: z.enum(["offer", "accept"]) }),
  /** Heartbeat: measures round-trip time and notices a stalled connection. */
  z.object({ t: z.literal("ping"), n: z.number().int().min(0).max(1_000_000_000) }),
  z.object({ t: z.literal("pong"), n: z.number().int().min(0).max(1_000_000_000) }),
]);
export type Message = z.infer<typeof MessageSchema>;

export function parseMessage(raw: unknown): Message | null {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) return null;
  try {
    const parsed = MessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serialize(msg: Message): string {
  return JSON.stringify(msg);
}

export type RemoteMoveResult = { ok: true; fen: string; san: string; from: string; to: string } | { ok: false; reason: string };

/**
 * Apply the opponent's move to our copy of the game. Rejected when it is not
 * their turn, illegal, or the move counter disagrees.
 */
export function applyRemoteMove(fen: string, remoteColor: "w" | "b", plies: number, msg: { uci: string; ply: number }): RemoteMoveResult {
  const chess = new Chess(fen);
  if (chess.turn() !== remoteColor) return { ok: false, reason: "Move received out of turn." };
  if (msg.ply !== plies + 1) return { ok: false, reason: "The games are out of sync." };
  const move = applyUci(chess, msg.uci);
  if (!move) return { ok: false, reason: "Illegal move received." };
  return { ok: true, fen: chess.fen(), san: move.san, from: move.from, to: move.to };
}
