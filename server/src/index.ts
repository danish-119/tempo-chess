import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createAuth } from "./auth";
import { ApiError } from "./errors";
import { appOrigins } from "./origins";
import { avatar } from "./routes/avatar";
import { data } from "./routes/data";
import { me } from "./routes/me";
import { online, publicOnline } from "./routes/online";
import type { AppEnv, SessionUser } from "./types";

/**
 * The Tempo API, a Cloudflare Worker.
 *
 *   /api/auth/*   sign-in with Google or as a guest, sessions, account deletion (Better Auth)
 *   /api/v1/me    the signed-in player
 *   /api/avatar/:id  a player's picture (public)
 *   /api/v1/...   the player's saved data
 *   /api/v1/online/...  create, join or cancel a game; /api/online/:code[/ws] to look at or watch one
 *   /health       for uptime checks
 *
 * Only the app's own origin may call it with cookies; every error has the same JSON shape:
 * { error: { code, message }, requestId }.
 */
const app = new Hono<AppEnv>();

app.use("*", requestId());
// Pictures are shown by the app, which may be on another site and is cross-origin isolated: the browser accepts
// them only with `Cross-Origin-Resource-Policy: cross-origin`. Registered before secureHeaders so it runs after it
// on the way out and is not overwritten by the API-wide `same-site`.
app.use("/api/avatar/*", async (c, next) => {
  await next();
  c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
});
app.use("*", secureHeaders({ crossOriginResourcePolicy: "same-site" }));
app.use("*", async (c, next) => {
  const allowed = appOrigins(c.env);
  return cors({
    origin: (o) => (allowed.includes(o) ? o : null),
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 600,
  })(c, next);
});
app.use("/api/*", bodyLimit({ maxSize: 2 * 1024 * 1024, onError: () => { throw new ApiError(413, "too_large", "This is too large to send."); } }));

// Changes must come from the app itself. The session cookie may be sent cross-site (when the app and the API are on
// different sites), so this, not the cookie's SameSite setting, is what stops another website acting for a player.
// Better Auth makes the same check on its own routes.
app.use("/api/v1/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && !appOrigins(c.env).includes(c.req.header("Origin") ?? "")) {
    throw new ApiError(403, "forbidden", "Not allowed from this site.");
  }
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));
app.route("/api/avatar", avatar);

// Watching a game needs no account; a signed-in viewer who is seated in the game plays.
app.use("/api/online/*", async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  c.set("user", (session?.user ?? null) as SessionUser);
  await next();
});
app.route("/api/online", publicOnline);

app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

// Everything under /api/v1 needs a session: a Google account or a guest.
app.use("/api/v1/*", async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new ApiError(401, "unauthorized", "Please sign in.");
  c.set("user", session.user as SessionUser);
  await next();
});
app.route("/api/v1/me", me);
app.route("/api/v1/online", online);
app.route("/api/v1", data);

app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found." }, requestId: c.var.requestId }, 404));

app.onError((err, c) => {
  const requestId = c.var.requestId;
  if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message }, requestId }, err.status);
  if (err instanceof HTTPException) {
    const status = err.status;
    const code = status === 400 ? "invalid_request" : status === 401 ? "unauthorized" : "error";
    return c.json({ error: { code, message: err.message || "The request could not be completed." }, requestId }, status);
  }
  console.error(JSON.stringify({ level: "error", requestId, path: c.req.path, message: err.message, stack: err.stack }));
  return c.json({ error: { code: "internal", message: "Something went wrong on our side. Please try again." }, requestId }, 500);
});

/**
 * Once a day: remove guests who have not been back for 30 days, that is, who have no session left (sessions last
 * 30 days and are renewed on use). Everything they saved goes with them.
 */
async function removeOldGuests(env: AppEnv["Bindings"]): Promise<void> {
  const now = Date.now();
  const r = await env.DB.prepare(
    "DELETE FROM user WHERE is_anonymous = 1 AND created_at < ?1 AND NOT EXISTS (SELECT 1 FROM session WHERE session.user_id = user.id AND session.expires_at > ?2)",
  )
    .bind(now - 24 * 60 * 60 * 1000, now)
    .run();
  console.log(JSON.stringify({ level: "info", job: "remove-old-guests", removed: r.meta.changes }));
}

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledController, env: AppEnv["Bindings"], ctx: ExecutionContext) {
    ctx.waitUntil(removeOldGuests(env));
  },
} satisfies ExportedHandler<AppEnv["Bindings"]>;
export { GameRoom } from "./game/GameRoom";
export type AppType = typeof app;
