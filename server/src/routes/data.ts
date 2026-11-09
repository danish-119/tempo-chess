import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { doc, game, review } from "../db/schema";
import type { AppEnv } from "../types";
import { ApiError } from "../errors";

/**
 * A player's saved data. Everything here needs a signed-in, verified player (see the `requireUser` middleware).
 *
 * - Documents (settings, progress, lesson progress, play preferences) are small JSON objects. Each save carries the
 *   version it was based on; a save based on an older version gets 409 with the current copy, so two devices
 *   never silently overwrite each other.
 * - Games and their reviews are stored as JSON, listed newest first.
 */
export const DOC_KEYS = ["settings", "progress", "basics", "play", "shortcuts", "rush"] as const;
const MAX_DOC_BYTES = 256 * 1024;
const MAX_GAME_BYTES = 512 * 1024;
const MAX_REVIEW_BYTES = 1024 * 1024;
const MAX_GAMES = 5000;

const docKey = z.object({ key: z.enum(DOC_KEYS) });
const docBody = z.object({ data: z.unknown(), baseVersion: z.number().int().min(0) });
const idParam = z.object({ id: z.string().min(1).max(100) });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(200), before: z.coerce.number().int().optional() });

const json = (value: unknown, max: number) => {
  const text = JSON.stringify(value);
  if (text === undefined) throw new ApiError(400, "invalid_body", "The data is missing.");
  if (text.length > max) throw new ApiError(413, "too_large", "This is too large to save.");
  return text;
};

export const data = new Hono<AppEnv>()
  // ---- documents
  .get("/docs", async (c) => {
    const db = drizzle(c.env.DB);
    const rows = await db.select().from(doc).where(eq(doc.userId, c.var.user.id));
    return c.json({ docs: rows.map((r) => ({ key: r.key, data: JSON.parse(r.data), version: r.version, updatedAt: r.updatedAt.getTime() })) });
  })
  .get("/docs/:key", zValidator("param", docKey), async (c) => {
    const db = drizzle(c.env.DB);
    const [row] = await db
      .select()
      .from(doc)
      .where(and(eq(doc.userId, c.var.user.id), eq(doc.key, c.req.valid("param").key)));
    if (!row) return c.json({ data: null, version: 0, updatedAt: null });
    return c.json({ data: JSON.parse(row.data), version: row.version, updatedAt: row.updatedAt.getTime() });
  })
  .put("/docs/:key", zValidator("param", docKey), zValidator("json", docBody), async (c) => {
    const db = drizzle(c.env.DB);
    const { key } = c.req.valid("param");
    const { data: value, baseVersion } = c.req.valid("json");
    const text = json(value, MAX_DOC_BYTES);
    const now = new Date();
    const userId = c.var.user.id;

    // One atomic statement: create at version 1, or bump the version only if nobody saved in between.
    const result =
      baseVersion === 0
        ? await db
            .insert(doc)
            .values({ userId, key, data: text, version: 1, updatedAt: now })
            .onConflictDoNothing()
            .returning({ version: doc.version })
        : await db
            .update(doc)
            .set({ data: text, version: sql`${doc.version} + 1`, updatedAt: now })
            .where(and(eq(doc.userId, userId), eq(doc.key, key), eq(doc.version, baseVersion)))
            .returning({ version: doc.version });

    if (result.length === 0) {
      const [current] = await db
        .select()
        .from(doc)
        .where(and(eq(doc.userId, userId), eq(doc.key, key)));
      return c.json(
        {
          error: { code: "conflict", message: "This was changed on another device." },
          current: current ? { data: JSON.parse(current.data), version: current.version, updatedAt: current.updatedAt.getTime() } : null,
        },
        409,
      );
    }
    return c.json({ version: result[0].version, updatedAt: now.getTime() });
  })

  // ---- games
  .get("/games", zValidator("query", listQuery), async (c) => {
    const db = drizzle(c.env.DB);
    const { limit, before } = c.req.valid("query");
    const where = before
      ? and(eq(game.userId, c.var.user.id), sql`${game.savedAt} < ${before}`)
      : eq(game.userId, c.var.user.id);
    const rows = await db.select().from(game).where(where).orderBy(desc(game.savedAt)).limit(limit);
    return c.json({
      games: rows.map((r) => JSON.parse(r.data)),
      next: rows.length === limit ? rows[rows.length - 1].savedAt.getTime() : null,
    });
  })
  .get("/games/:id", zValidator("param", idParam), async (c) => {
    const db = drizzle(c.env.DB);
    const [row] = await db
      .select()
      .from(game)
      .where(and(eq(game.userId, c.var.user.id), eq(game.id, c.req.valid("param").id)));
    if (!row) throw new ApiError(404, "not_found", "That game was not found.");
    return c.json({ game: JSON.parse(row.data) });
  })
  .put("/games/:id", zValidator("param", idParam), zValidator("json", z.object({ game: z.record(z.string(), z.unknown()) })), async (c) => {
    const db = drizzle(c.env.DB);
    const { id } = c.req.valid("param");
    const { game: value } = c.req.valid("json");
    if (value.id !== id) throw new ApiError(400, "invalid_body", "The game id does not match.");
    const text = json(value, MAX_GAME_BYTES);
    const userId = c.var.user.id;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(game).where(eq(game.userId, userId));
    const exists = await db.select({ id: game.id }).from(game).where(and(eq(game.userId, userId), eq(game.id, id)));
    if (!exists.length && count >= MAX_GAMES) throw new ApiError(409, "limit_reached", `You can keep up to ${MAX_GAMES} games. Delete some to save more.`);
    const savedAt = typeof value.savedAt === "number" ? new Date(value.savedAt) : new Date();
    await db
      .insert(game)
      .values({ userId, id, data: text, savedAt })
      .onConflictDoUpdate({ target: [game.userId, game.id], set: { data: text } });
    return c.json({ ok: true });
  })
  .delete("/games/:id", zValidator("param", idParam), async (c) => {
    const db = drizzle(c.env.DB);
    const { id } = c.req.valid("param");
    const userId = c.var.user.id;
    await db.batch([
      db.delete(review).where(and(eq(review.userId, userId), eq(review.gameId, id))),
      db.delete(game).where(and(eq(game.userId, userId), eq(game.id, id))),
    ]);
    return c.body(null, 204);
  })

  // ---- reviews
  .get("/reviews", async (c) => {
    const db = drizzle(c.env.DB);
    const rows = await db.select().from(review).where(eq(review.userId, c.var.user.id)).orderBy(desc(review.updatedAt));
    return c.json({ reviews: rows.map((r) => JSON.parse(r.data)) });
  })
  .get("/reviews/:id", zValidator("param", idParam), async (c) => {
    const db = drizzle(c.env.DB);
    const [row] = await db
      .select()
      .from(review)
      .where(and(eq(review.userId, c.var.user.id), eq(review.gameId, c.req.valid("param").id)));
    return c.json({ review: row ? JSON.parse(row.data) : null });
  })
  .put("/reviews/:id", zValidator("param", idParam), zValidator("json", z.object({ review: z.record(z.string(), z.unknown()) })), async (c) => {
    const db = drizzle(c.env.DB);
    const { id } = c.req.valid("param");
    const text = json(c.req.valid("json").review, MAX_REVIEW_BYTES);
    const now = new Date();
    await db
      .insert(review)
      .values({ userId: c.var.user.id, gameId: id, data: text, updatedAt: now })
      .onConflictDoUpdate({ target: [review.userId, review.gameId], set: { data: text, updatedAt: now } });
    return c.json({ ok: true });
  });
