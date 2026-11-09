import type { Env } from "./env";

/** The app origins allowed to call the API (APP_ORIGIN, comma-separated). */
export function appOrigins(env: Env): string[] {
  return env.APP_ORIGIN.split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/** The main app origin, used for links in emails. */
export function primaryOrigin(env: Env): string {
  return appOrigins(env)[0];
}
