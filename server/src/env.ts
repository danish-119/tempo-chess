import type { GameRoom } from "./game/GameRoom";

/** The Worker's bindings and settings (see wrangler.jsonc and .dev.vars). */
export interface Env {
  DB: D1Database;
  /** One referee per online game, named by the game code. */
  GAME: DurableObjectNamespace<GameRoom>;
  /**
   * Where the app runs, e.g. "https://tempo.example": the only origins allowed to call the API with cookies.
   * Several can be listed, comma-separated (production first, then previews).
   */
  APP_ORIGIN: string;
  /** Where this API runs, e.g. https://api.tempo.example. */
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  /** Set when the app and the API share a parent domain, e.g. "tempo.example", so the sign-in cookie covers both. */
  COOKIE_DOMAIN?: string;
  /** The Google OAuth client; without it nobody can sign in (guests can still use the app). */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
