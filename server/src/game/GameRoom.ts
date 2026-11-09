import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { parseClientMessage, snapshot } from "./protocol";
import {
  type Color,
  type GameState,
  type Player,
  type TimeControl,
  cancel,
  checkTime,
  colorOf,
  deadline,
  join,
  newGame,
  offerDraw,
  declineDraw,
  playMove,
  resign,
  toPgn,
} from "./rules";

/** What each socket is, kept on the socket itself so it survives hibernation. */
interface Attachment {
  userId: string | null;
  role: "w" | "b" | "spectator";
  lag: number;
}

const MAX_MESSAGES_PER_SECOND = 20;

/**
 * One online game: the referee. It owns the game state, persists it after every change, keeps one alarm for the
 * next deadline (flag, first move, or an unanswered invite), and talks to players and spectators over hibernatable
 * WebSockets. The Worker only routes to it: identity comes from the Worker, which has already checked the session.
 */
export class GameRoom extends DurableObject<Env> {
  private state: GameState | null = null;
  /** Messages per socket in the current second (in memory only; a reset after hibernation is harmless). */
  private rate = new Map<WebSocket, { second: number; count: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<GameState>("state")) ?? null;
    });
  }

  // ---- called by the Worker (RPC)

  async create(init: { code: string; tc: TimeControl; creator: Player; color: Color | "random" }): Promise<void> {
    if (this.state) throw new Error("exists");
    await this.save(newGame(init.code, init.tc, init.creator, init.color, Date.now()));
  }

  async info(): Promise<ReturnType<typeof snapshot> | null> {
    return this.state ? snapshot(this.state, Date.now(), "spectator", null) : null;
  }

  /** Seat a second player. Returns an error message, or null when they are now playing (or already were). */
  async join(player: Player): Promise<string | null> {
    if (!this.state) return "This game does not exist.";
    if (colorOf(this.state, player.id)) return null;
    const next = join(this.state, player, Date.now());
    if (typeof next === "string") return next;
    await this.save(next);
    await this.env.DB.prepare("UPDATE online_game SET status = 'playing', white_id = ?, black_id = ? WHERE code = ?")
      .bind(next.players.w?.id ?? null, next.players.b?.id ?? null, next.code)
      .run();
    // Sockets opened before the player was seated (e.g. watching the invite) now play.
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment;
      if (a.userId && colorOf(next, a.userId)) ws.serializeAttachment({ ...a, role: colorOf(next, a.userId) });
    }
    this.broadcastState();
    return null;
  }

  async cancel(userId: string): Promise<string | null> {
    return this.act((s) => cancel(s, userId, Date.now()));
  }

  // ---- WebSockets

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!this.state) return new Response("Not found", { status: 404 });
    const userId = request.headers.get("X-Tempo-User") || null;
    const role: Attachment["role"] = (userId && colorOf(this.state, userId)) || "spectator";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [role === "spectator" ? "spectator" : "player"]);
    server.serializeAttachment({ userId, role, lag: 0 } satisfies Attachment);
    server.send(JSON.stringify(snapshot(this.state, Date.now(), role, userId)));
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.state || !this.allow(ws)) return;
    const msg = parseClientMessage(raw);
    if (!msg) return this.sendError(ws, "bad_message", "That message was not understood.");
    const a = ws.deserializeAttachment() as Attachment;

    if (msg.t === "ping") {
      if (msg.lag !== undefined) ws.serializeAttachment({ ...a, lag: msg.lag });
      ws.send(JSON.stringify({ t: "pong", n: msg.n, serverTime: Date.now() }));
      return;
    }
    // Spectators only watch.
    if (a.role === "spectator" || !a.userId) {
      if (msg.t === "cancel" && a.userId) {
        const err = await this.cancel(a.userId);
        if (err) this.sendError(ws, "refused", err);
        return;
      }
      return this.sendError(ws, "spectator", "You are watching this game.");
    }

    const userId = a.userId;
    const now = Date.now();
    switch (msg.t) {
      case "move": {
        // A move for an old position is a duplicate or a stale retry: answer with the current state.
        if (msg.ply !== this.state.moves.length + 1) return ws.send(JSON.stringify(snapshot(this.state, now, a.role, a.userId)));
        const r = playMove(this.state, userId, msg.uci, now, a.lag);
        if (!r.ok) {
          this.sendError(ws, "illegal", r.error);
          return ws.send(JSON.stringify(snapshot(this.state, now, a.role, a.userId)));
        }
        await this.save(r.state);
        if (r.san) {
          this.broadcast({
            t: "move",
            uci: msg.uci,
            san: r.san,
            ply: r.state.moves.length,
            fen: r.state.fen,
            clock: r.state.clock,
            drawOffer: r.state.drawOffer,
            serverTime: now,
          });
        }
        if (r.state.status === "ended") {
          // Everyone (players and spectators) gets the final position and the result.
          this.broadcastState();
          await this.finish();
        }
        return;
      }
      case "resign":
        return void (await this.act((s) => resign(s, userId, now), ws));
      case "draw":
        return void (await this.act(
          (s) => (msg.action === "decline" ? declineDraw(s, userId) : offerDraw(s, userId, now)),
          ws,
        ));
      case "cancel":
        return void (await this.act((s) => cancel(s, userId, now), ws));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.rate.delete(ws);
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
    this.broadcastPresence(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.rate.delete(ws);
    this.broadcastPresence(ws);
  }

  // ---- the clock

  async alarm(): Promise<void> {
    if (!this.state) return;
    const next = checkTime(this.state, Date.now());
    if (next === this.state) return this.schedule(); // not due yet (an early or repeated alarm)
    await this.save(next);
    this.broadcastState();
    await this.finish();
  }

  // ---- helpers

  private async act(fn: (s: GameState) => GameState | string, ws?: WebSocket): Promise<string | null> {
    if (!this.state) return "This game does not exist.";
    const next = fn(this.state);
    if (typeof next === "string") {
      if (ws) this.sendError(ws, "refused", next);
      return next;
    }
    await this.save(next);
    this.broadcastState();
    if (next.status === "ended") await this.finish();
    return null;
  }

  private async save(next: GameState): Promise<void> {
    this.state = next;
    await this.ctx.storage.put("state", next);
    await this.schedule();
  }

  private async schedule(): Promise<void> {
    const due = this.state ? deadline(this.state) : null;
    if (due === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(due);
  }

  /** Record the finished game once, for both players' history. */
  private async finish(): Promise<void> {
    const s = this.state;
    if (!s || s.status !== "ended" || !s.result) return;
    const done = await this.ctx.storage.get<boolean>("recorded");
    if (done) return;
    try {
      await this.env.DB.prepare(
        `UPDATE online_game SET status = 'ended', white_id = ?, black_id = ?, result = ?, reason = ?, pgn = ?, ended_at = ? WHERE code = ?`,
      )
        .bind(s.players.w?.id ?? null, s.players.b?.id ?? null, s.result.result, s.result.reason, s.moves.length ? toPgn(s) : null, s.endedAt, s.code)
        .run();
      await this.ctx.storage.put("recorded", true);
    } catch (err) {
      // Retried by the next alarm.
      console.error(JSON.stringify({ level: "error", where: "GameRoom.finish", code: s.code, message: (err as Error).message }));
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
    }
  }

  private allow(ws: WebSocket): boolean {
    const second = Math.floor(Date.now() / 1000);
    const r = this.rate.get(ws);
    if (!r || r.second !== second) {
      this.rate.set(ws, { second, count: 1 });
      return true;
    }
    r.count++;
    return r.count <= MAX_MESSAGES_PER_SECOND;
  }

  private sendError(ws: WebSocket, code: string, message: string) {
    try {
      ws.send(JSON.stringify({ t: "error", code, message }));
    } catch {
      /* socket closing */
    }
  }

  private broadcast(msg: unknown) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        /* socket closing */
      }
    }
  }

  private broadcastState() {
    if (!this.state) return;
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment;
      try {
        ws.send(JSON.stringify(snapshot(this.state, now, a.role, a.userId)));
      } catch {
        /* socket closing */
      }
    }
  }

  /** Who is here: whether each player is connected, and how many are watching. */
  private broadcastPresence(leaving?: WebSocket) {
    const open = this.ctx.getWebSockets().filter((ws) => ws !== leaving);
    const roles = open.map((ws) => (ws.deserializeAttachment() as Attachment).role);
    this.broadcast({ t: "presence", w: roles.includes("w"), b: roles.includes("b"), watching: roles.filter((r) => r === "spectator").length });
  }
}
