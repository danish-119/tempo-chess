import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { onlineGame } from "../db/schema";
import { ApiError } from "../errors";
import { type Player, TIME_CONTROLS, timeControl } from "../game/rules";
import { appOrigins, primaryOrigin } from "../origins";
import type { AppEnv, SessionUser } from "../types";
import { isAllowedImageUrl } from "./avatar";

/** Game codes: 6 characters with no look-alikes (no 0/O, 1/I/L), about a billion possibilities. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** How a player appears to others in a game. */
export function asPlayer(u: SessionUser, apiOrigin: string): Player {
  return {
    id: u.id,
    name: u.name,
    tag: u.tag,
    image: u.image && isAllowedImageUrl(u.image) ? `${apiOrigin}/api/avatar/${u.id}` : null,
    ...(u.isAnonymous ? { guest: true } : {}),
  };
}

const createBody = z.object({
  tc: z.enum(TIME_CONTROLS.map((t) => t.id) as [string, ...string[]]),
  color: z.enum(["w", "b", "random"]).default("random"),
});
const codeParam = z.object({ code: z.string().regex(CODE) });

/** Routes for players (mounted under /api/v1/online, behind the session check): accounts and guests alike. */
export const online = new Hono<AppEnv>()
  /** Make a game; whoever has its code (or link) can join it. */
  .post("/", zValidator("json", createBody), async (c) => {
    const me = c.var.user;
    const { tc: tcId, color } = c.req.valid("json");
    const db = drizzle(c.env.DB);

    // A fresh code; on the rare clash, try again.
    let code = "";
    for (let i = 0; i < 5 && !code; i++) {
      const candidate = newCode();
      const inserted = await db
        .insert(onlineGame)
        .values({ code: candidate, creatorId: me.id, timeControl: tcId, rated: false, status: "waiting", createdAt: new Date() })
        .onConflictDoNothing()
        .returning({ code: onlineGame.code });
      if (inserted.length) code = candidate;
    }
    if (!code) throw new ApiError(503, "busy", "Could not create a game right now. Please try again.");

    await c.env.GAME.getByName(code).create({ code, tc: timeControl(tcId)!, creator: asPlayer(me, c.env.BETTER_AUTH_URL), color });
    const app = primaryOrigin(c.env);
    // One address per game: it offers Join to a friend, the board to the players and a live view to everyone else.
    return c.json({ code, url: `${app}/play/game?code=${code}` }, 201);
  })

  .post("/:code/join", zValidator("param", codeParam), async (c) => {
    const me = c.var.user;
    const err = await c.env.GAME.getByName(c.req.valid("param").code).join(asPlayer(me, c.env.BETTER_AUTH_URL));
    if (err) throw new ApiError(409, "cannot_join", err);
    return c.json({ ok: true });
  })
  .post("/:code/cancel", zValidator("param", codeParam), async (c) => {
    const err = await c.env.GAME.getByName(c.req.valid("param").code).cancel(c.var.user.id);
    if (err) throw new ApiError(409, "refused", err);
    return c.json({ ok: true });
  });

/** WebSocket upgrades are not covered by CORS, so the origin is checked by hand. */
export function checkOrigin(origin: string | undefined, allowed: string[]): void {
  if (!origin || !allowed.includes(origin)) throw new ApiError(403, "forbidden", "Not allowed from this site.");
}

/** Public routes (mounted under /api/online): anyone may look at a game or watch it. */
export const publicOnline = new Hono<AppEnv & { Variables: { user: SessionUser | null } }>()
  .get("/:code", zValidator("param", codeParam), async (c) => {
    const info = await c.env.GAME.getByName(c.req.valid("param").code).info();
    if (!info) throw new ApiError(404, "not_found", "There is no game with that code.");
    return c.json(info);
  })
  .get("/:code/ws", zValidator("param", codeParam), async (c) => {
    if (c.req.header("Upgrade") !== "websocket") throw new ApiError(400, "invalid_request", "Expected a WebSocket.");
    checkOrigin(c.req.header("Origin"), appOrigins(c.env));
    // Identity comes only from here (the session), never from the client: the room trusts this header.
    const headers = new Headers(c.req.raw.headers);
    headers.delete("X-Tempo-User");
    const viewer = c.get("user");
    if (viewer) headers.set("X-Tempo-User", viewer.id);
    return c.env.GAME.getByName(c.req.valid("param").code).fetch(new Request(c.req.raw, { headers }));
  });
