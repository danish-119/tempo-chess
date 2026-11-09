import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { user } from "../db/schema";
import { isAllowedImageUrl } from "./avatar";
import { ApiError } from "../errors";
import type { AppEnv } from "../types";

/**
 * The signed-in player: what the app needs for the header (name, Tempo ID, avatar).
 * Read from the database rather than the session, so a name change shows straight away.
 */
export const me = new Hono<AppEnv>().get("/", async (c) => {
  const [u] = await drizzle(c.env.DB).select().from(user).where(eq(user.id, c.var.user.id));
  if (!u) throw new ApiError(401, "unauthorized", "Please sign in.");
  return c.json({
    id: u.id,
    email: u.email,
    name: u.name,
    /** Served through the API, so the cross-origin-isolated app can show it. */
    image: u.image && isAllowedImageUrl(u.image) ? `${c.env.BETTER_AUTH_URL}/api/avatar/${u.id}?v=${u.updatedAt.getTime()}` : null,
    tag: u.tag,
    /** A guest: everything works, but it lasts only while they come back, on this browser. */
    guest: u.isAnonymous,
  });
});
