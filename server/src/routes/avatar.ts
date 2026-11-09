import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { user } from "../db/schema";
import type { AppEnv } from "../types";

/**
 * A player's picture, served from the API.
 *
 * The app is cross-origin isolated (the multi-threaded engine needs it), so the browser refuses images from other
 * sites unless they opt in. Pictures are therefore fetched here and passed on from our own domain: a Google photo,
 * or a guest's DiceBear picture. Only those two kinds of address are ever fetched, so this cannot be used to reach
 * anything else.
 */
const GOOGLE_HOST = /^lh\d+\.googleusercontent\.com$/;
const MAX_BYTES = 512 * 1024;

/**
 * The DiceBear styles a guest can choose from, each with fixed options: friendly faces, natural skin tones and soft
 * backgrounds. Avataaars is by Pablo Stanley (free for personal and commercial use); Open Peeps (Pablo Stanley) and
 * Thumbs are public domain (CC0).
 */
const PASTELS = "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf";
const STYLE_OPTIONS: Record<string, string> = {
  avataaars: `mouth=smile,default,twinkle&eyes=default,happy,wink&eyebrows=default,defaultNatural,raisedExcited,raisedExcitedNatural&skinColor=614335,d08b5b,ae5d29,edb98a,ffdbb4&backgroundColor=${PASTELS}`,
  "open-peeps": `face=smile,smileBig,smileTeethGap,cute,calm,cheeky,awe,driven,lovingGrin1&backgroundColor=${PASTELS}`,
  thumbs: "",
};
export const GUEST_STYLES = Object.keys(STYLE_OPTIONS);
const SEED = /^[a-zA-Z0-9]{1,16}$/;

/** The DiceBear picture for this style and seed, or null when they are not from the offered set. */
export function guestAvatarUrl(style: unknown, seed: unknown): string | null {
  if (typeof style !== "string" || !Object.hasOwn(STYLE_OPTIONS, style)) return null;
  if (typeof seed !== "string" || !SEED.test(seed)) return null;
  const options = STYLE_OPTIONS[style];
  return `https://api.dicebear.com/9.x/${style}/png?seed=${seed}&size=128${options ? `&${options}` : ""}`;
}

/**
 * The picture a DiceBear address stands for, rebuilt from its style and seed alone (so nothing else in it is
 * trusted), or null when it is not one of the offered pictures.
 */
export function canonicalGuestAvatar(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    const m = /^\/9\.x\/([a-z-]+)\/png$/.exec(u.pathname);
    if (u.protocol !== "https:" || u.hostname !== "api.dicebear.com" || !m) return null;
    return guestAvatarUrl(m[1], u.searchParams.get("seed"));
  } catch {
    return null;
  }
}

export function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (GOOGLE_HOST.test(u.hostname)) return true;
    return u.hostname === "api.dicebear.com" && canonicalGuestAvatar(raw) === raw;
  } catch {
    return false;
  }
}

/** Fetch an allowed picture (through the edge cache) and pass it on from our domain. */
async function relay(image: string, waitUntil: (p: Promise<unknown>) => void): Promise<Response | null> {
  const cache = caches.default;
  const key = new Request(`https://avatar.cache/${encodeURIComponent(image)}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  const upstream = await fetch(image, { cf: { cacheTtl: 86400 } });
  const type = upstream.headers.get("content-type") ?? "";
  const length = Number(upstream.headers.get("content-length") ?? 0);
  // Raster images only: an SVG could carry script if someone opened it directly.
  if (!upstream.ok || !/^image\/(png|jpeg|webp|gif)$/.test(type) || length > MAX_BYTES) return null;
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return null;

  const res = new Response(body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
  waitUntil(cache.put(key, res.clone()));
  return res;
}

export const avatar = new Hono<AppEnv>()
  /** The pictures a guest can choose from, before they have an account to attach one to. */
  .get("/guest/:style/:seed", async (c) => {
    const image = guestAvatarUrl(c.req.param("style"), c.req.param("seed"));
    const res = image ? await relay(image, (p) => c.executionCtx.waitUntil(p)) : null;
    return res ?? c.body(null, 404);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    if (!/^[0-9a-f-]{36}$/.test(id)) return c.body(null, 404);
    const [row] = await drizzle(c.env.DB).select({ image: user.image }).from(user).where(eq(user.id, id));
    if (!row?.image || !isAllowedImageUrl(row.image)) return c.body(null, 404);
    return (await relay(row.image, (p) => c.executionCtx.waitUntil(p))) ?? c.body(null, 404);
  });
