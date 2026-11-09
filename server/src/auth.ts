import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { anonymous } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import type { Env } from "./env";
import { appOrigins } from "./origins";
import { canonicalGuestAvatar, guestAvatarUrl } from "./routes/avatar";
import { displayName, nameFromProvider, newTag } from "./players";

/**
 * Sign-in for Tempo: Google is the only way in, so Tempo never stores a password or sends an email.
 *
 * Every player has a display name (it need not be unique) and a Tempo ID that we assign, such as 4K7F2QD (unique,
 * never chosen, never changes). It tells players with the same name apart.
 *
 * Visitors who have not signed in become guests the first time they save something (a finished lesson, a setting,
 * a game): a guest session, kept on the server, so nothing is stored in the browser but a cookie. A guest is a full
 * player with an ID; they only lack permanence: a guest lasts while they come back at least once every 30 days, on
 * that one browser (see `removeOldGuests`). Signing in with Google moves everything a guest saved into the account,
 * and a brand-new account keeps the guest's ID.
 *
 * Built per request because a Worker only sees its bindings (database, secrets) inside a request.
 */
export function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema });
  const production = env.BETTER_AUTH_URL.startsWith("https://");

  return betterAuth({
    appName: "Tempo",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: appOrigins(env),
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: { ...schema, rateLimit: schema.rateLimit },
    }),

    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" } }
        : {},

    user: {
      additionalFields: {
        /** The Tempo ID, set when the account is created; players cannot change it. */
        tag: { type: "string", required: false, input: false },
      },
      // A player deletes their account from a session started in the last day (otherwise they sign in again first).
      deleteUser: { enabled: true },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // A short-lived signed copy of the session in a cookie, so most requests skip the database.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/social": { window: 60, max: 10 },
        "/sign-in/anonymous": { window: 60 * 10, max: 10 },
        "/get-session": false,
      },
    },

    advanced: {
      cookiePrefix: "tempo",
      useSecureCookies: production,
      // The app and the API on two different sites (e.g. vercel.app and workers.dev): the session cookie must be
      // allowed on cross-site requests, or the app could never send it. Every request that changes something is
      // then also checked for the app's own Origin (Better Auth for its routes, index.ts for the rest). Browsers
      // that block third-party cookies (Safari, private windows) will not keep a session in this setup; with a
      // shared parent domain (COOKIE_DOMAIN) the cookie stays first-party and Lax.
      ...(production && !env.COOKIE_DOMAIN ? { defaultCookieAttributes: { sameSite: "none" as const, secure: true } } : {}),
      // Cloudflare sets this header itself and overwrites anything a client sends, so it cannot be spoofed.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      crossSubDomainCookies: env.COOKIE_DOMAIN ? { enabled: true, domain: env.COOKIE_DOMAIN } : undefined,
      database: { generateId: () => crypto.randomUUID() },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (u, ctx) => {
            // A clash of two random IDs is about one in 27 billion; the unique index refuses it and sign-in is retried.
            const tag = newTag();
            if (ctx?.path === "/sign-in/anonymous") {
              // A guest's chosen picture comes with the guest sign-in; anything not from the offered set is ignored.
              const avatar = (ctx.body as { avatar?: { style?: unknown; seed?: unknown } } | undefined)?.avatar;
              return { data: { ...u, tag, image: guestAvatarUrl(avatar?.style, avatar?.seed) } };
            }
            return { data: { ...u, tag, name: nameFromProvider(u.name) } };
          },
        },
        update: {
          // A new display name must be a sensible one, and a new picture one of the offered DiceBear pictures.
          before: async (data) => {
            let next = data;
            if (data.image !== undefined && data.image !== null) {
              const image = canonicalGuestAvatar(data.image);
              if (!image) throw new APIError("BAD_REQUEST", { code: "INVALID_IMAGE", message: "Choose one of the offered pictures." });
              next = { ...next, image };
            }
            if (data.name === undefined) return { data: next };
            const name = displayName(data.name);
            if (!name) throw new APIError("BAD_REQUEST", { code: "INVALID_NAME", message: "Names are 2 to 24 letters, numbers or spaces." });
            return { data: { ...next, name } };
          },
        },
      },
    },

    plugins: [
      anonymous({
        // A nickname the guest typed (to play online), or "Guest" for one made silently by a first save.
        generateName: (ctx) => {
          const raw = (ctx.body as { name?: unknown } | undefined)?.name;
          if (raw === undefined) return GUEST_NAME;
          const name = displayName(raw);
          if (!name) throw new APIError("BAD_REQUEST", { code: "INVALID_NAME", message: "Nicknames are 2 to 24 letters, numbers or spaces." });
          return name;
        },
        // Signing in with Google from a guest session: everything the guest saved moves into the account (the
        // plugin then deletes the guest).
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await adoptGuest(env.DB, anonymousUser.user.id, newUser.user.id, new Date(newUser.user.createdAt).getTime());
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** The name of a guest who has not chosen a nickname yet. */
export const GUEST_NAME = "Guest";

/**
 * Move a guest's saved data into an account. Where the account already has a record of the same kind (an existing
 * account signing in on a new browser), the account's copy is kept. A brand-new account (created by this sign-in)
 * also takes over the guest's Tempo ID, so friends who know it can still find them.
 */
export async function adoptGuest(db: D1Database, guestId: string, userId: string, userCreatedAt: number): Promise<void> {
  const move = (table: string, column = "user_id") => db.prepare(`UPDATE OR IGNORE ${table} SET ${column} = ?1 WHERE ${column} = ?2`).bind(userId, guestId);
  const steps = [
    move("doc"),
    move("game"),
    move("review"),
    move("online_game", "creator_id"),
    move("online_game", "white_id"),
    move("online_game", "black_id"),
  ];
  const guest = Date.now() - userCreatedAt < 5 * 60 * 1000 ? await db.prepare("SELECT tag FROM user WHERE id = ?1").bind(guestId).first<{ tag: string }>() : null;
  if (guest) {
    // IDs must stay unique at every step: free the guest's ID (the guest is deleted next), then give it to the account.
    steps.push(
      db.prepare("UPDATE user SET tag = 'x' || id WHERE id = ?1").bind(guestId),
      db.prepare("UPDATE user SET tag = ?1 WHERE id = ?2").bind(guest.tag, userId),
    );
  }
  await db.batch(steps);
}
