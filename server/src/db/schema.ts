import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/*
 * The database (Cloudflare D1, which is SQLite).
 *
 * The first four tables are the ones Better Auth needs (users, sessions, linked sign-in methods and one-time
 * verification tokens), with the Tempo ID and the guest flag on `user`. The rest hold each player's data, which
 * used to live in the browser: small JSON documents (settings, progress, lesson progress), saved games and reviews.
 */

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  /** The Tempo ID (7 characters, such as 4K7F2QD): assigned at creation, unique, never changes. */
  tag: text("tag").notNull().unique(),
  /** A guest: plays online under a nickname, saves nothing, and is removed a week after arriving. */
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** One JSON document per player and key: "settings", "progress", "basics", "play". */
export const doc = sqliteTable(
  "doc",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    data: text("data").notNull(),
    /** Goes up by one on every save; a save based on an older version is refused, so devices never overwrite each other. */
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/** A saved game (the app's SavedGame), stored as JSON. */
export const game = sqliteTable(
  "game",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    data: text("data").notNull(),
    savedAt: timestamp("saved_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index("game_user_saved_idx").on(t.userId, t.savedAt)],
);

/** The review of a saved game, stored as JSON. */
export const review = sqliteTable(
  "review",
  {
    gameId: text("game_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    data: text("data").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

/** Better Auth's rate-limit counters (in-memory counting does not work across Workers). */
export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

/**
 * Every online game: created when someone makes a game, completed by the game room when it ends.
 * The live game itself is in its GameRoom; this is the index of a player's online games.
 */
export const onlineGame = sqliteTable(
  "online_game",
  {
    code: text("code").primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    whiteId: text("white_id").references(() => user.id, { onDelete: "set null" }),
    blackId: text("black_id").references(() => user.id, { onDelete: "set null" }),
    timeControl: text("time_control").notNull(),
    rated: integer("rated", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["waiting", "playing", "ended"] }).notNull(),
    result: text("result"),
    reason: text("reason"),
    pgn: text("pgn"),
    createdAt: timestamp("created_at").notNull(),
    endedAt: integer("ended_at"),
  },
  (t) => [
    index("online_game_creator_idx").on(t.creatorId, t.status),
    index("online_game_white_idx").on(t.whiteId),
    index("online_game_black_idx").on(t.blackId),
  ],
);
