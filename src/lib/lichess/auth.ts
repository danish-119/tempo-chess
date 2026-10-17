/**
 * Optional "Connect Lichess" login, done entirely in the browser with OAuth
 * 2.0 Authorization Code + PKCE (Lichess needs no app registration or client
 * secret). The token is used only to call the Lichess opening explorer, which
 * requires a logged-in user. It is kept in this browser's localStorage and
 * revoked on disconnect. No scopes are requested: the token cannot read or
 * change anything in the user's account beyond their public profile.
 * https://lichess.org/api#tag/OAuth
 */
export const LICHESS_ORIGIN = "https://lichess.org";
export const LICHESS_CLIENT_ID = "tempo-chess";
export const CALLBACK_PATH = "/auth/lichess";
const TOKEN_KEY = "tempo:lichess:auth:v1";
const PENDING_KEY = "tempo:lichess:pending";
const CHANGE_EVENT = "tempo:lichess-auth";

export interface LichessAuth {
  token: string;
  username: string | null;
  /** epoch ms, or null if the token doesn't say. */
  expiresAt: number | null;
}

interface Pending {
  verifier: string;
  state: string;
  returnTo: string;
}

export class LichessAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LichessAuthError";
  }
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** PKCE S256 challenge for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function redirectUri(origin = window.location.origin): string {
  return `${origin}${CALLBACK_PATH}`;
}

/** Only return to a path on this site. */
export function safeReturnPath(path: string | null | undefined): string {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/analyze";
}

// ---- stored token ------------------------------------------------------------

let cachedRaw: string | null | undefined;
let cachedAuth: LichessAuth | null = null;

export function getLichessAuth(): LichessAuth | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedAuth;
  cachedRaw = raw;
  cachedAuth = null;
  if (raw) {
    try {
      const a = JSON.parse(raw) as LichessAuth;
      if (typeof a.token === "string" && (a.expiresAt === null || a.expiresAt > Date.now())) cachedAuth = a;
    } catch {
      /* corrupt: treat as logged out */
    }
  }
  return cachedAuth;
}

function store(auth: LichessAuth | null) {
  try {
    if (auth) localStorage.setItem(TOKEN_KEY, JSON.stringify(auth));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore. */
export function subscribeLichessAuth(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Forget a token that Lichess rejected. */
export function dropLichessAuth(): void {
  store(null);
}

// ---- login flow --------------------------------------------------------------

export async function startLichessLogin(returnTo: string): Promise<void> {
  const verifier = randomToken(48);
  const state = randomToken(16);
  const pending: Pending = { verifier, state, returnTo: safeReturnPath(returnTo) };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  const url = new URL(`${LICHESS_ORIGIN}/oauth`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: LICHESS_CLIENT_ID,
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: await pkceChallenge(verifier),
    state,
  }).toString();
  window.location.assign(url.toString());
}

/** Finish the login on the callback page. Returns where to go next. */
export async function completeLichessLogin(params: URLSearchParams): Promise<string> {
  let pending: Pending | null = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as Pending | null;
  } catch {
    pending = null;
  }
  sessionStorage.removeItem(PENDING_KEY);
  const error = params.get("error");
  if (error) throw new LichessAuthError(error === "access_denied" ? "You cancelled the Lichess login." : "Lichess login failed.");
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) throw new LichessAuthError("This login link has expired. Please try again.");

  let res: Response;
  try {
    res = await fetch(`${LICHESS_ORIGIN}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: pending.verifier,
        redirect_uri: redirectUri(),
        client_id: LICHESS_CLIENT_ID,
      }),
    });
  } catch {
    throw new LichessAuthError("Couldn't reach Lichess. Check your connection and try again.");
  }
  if (!res.ok) throw new LichessAuthError("Lichess didn't accept the login. Please try again.");
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new LichessAuthError("Lichess didn't return a token.");
  const token = body.access_token;

  let username: string | null = null;
  try {
    const acc = await fetch(`${LICHESS_ORIGIN}/api/account`, { headers: { Authorization: `Bearer ${token}` } });
    if (acc.ok) username = ((await acc.json()) as { username?: string }).username ?? null;
  } catch {
    /* the name is only for display */
  }
  store({ token, username, expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : null });
  return pending.returnTo;
}

/** Revoke the token at Lichess (best effort) and forget it. */
export async function disconnectLichess(): Promise<void> {
  const auth = getLichessAuth();
  store(null);
  if (!auth) return;
  try {
    await fetch(`${LICHESS_ORIGIN}/api/token`, { method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` } });
  } catch {
    /* already forgotten locally */
  }
}
