import type { Env } from "./env";

/** The signed-in player, as the routes see it. */
export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  /** The Tempo ID. */
  tag: string;
  /** A guest (no Google account): may play online by code, nothing else. */
  isAnonymous?: boolean | null;
}

export interface AppEnv {
  Bindings: Env;
  Variables: { user: SessionUser; requestId: string };
}
