// End-to-end check of accounts, guests and saved data against a running local API (npm run dev).
// Usage: node scripts/smoke.mjs
import { testPlayer } from "./test-player.mjs";

const API = process.env.API ?? "http://localhost:8787";
const O = { Origin: process.env.ORIGIN ?? "http://localhost:3000" };
let ok = 0, bad = 0;
const check = (label, got, want) => { const pass = got === want; pass ? ok++ : bad++; console.log(pass ? "ok  " : "FAIL", label, pass ? "" : `got ${got}, want ${want}`); };
async function req(path, { cookie, method = "GET", body } = {}) {
  const r = await fetch(API + path, { method, headers: { ...O, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, setCookie: r.headers.getSetCookie?.() ?? [], type: r.headers.get("content-type") };
}
for (let i = 0; i < 40; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }

check("bad nickname refused", (await req("/api/auth/sign-in/anonymous", { method: "POST", body: { name: "!" } })).status, 400);
const g = await req("/api/auth/sign-in/anonymous", { method: "POST", body: { name: "Lucky  Star", avatar: { style: "thumbs", seed: "abc123" } } });
check("guest sign-in", g.status, 200);
const gc = g.setCookie.map((c) => c.split(";")[0]).join("; ");
const gs = await req("/api/auth/get-session", { cookie: gc });
check("guest is anonymous", gs.json?.user?.isAnonymous, true);
check("guest name tidied", gs.json?.user?.name, "Lucky Star");
check("guest has a picture", gs.json?.user?.image?.startsWith("https://api.dicebear.com/9.x/thumbs/png?seed=abc123"), true);
check("guest has a Tempo ID", /^[A-Z2-9]{7}$/.test(gs.json?.user?.tag ?? ""), true);
check("guest picture served", (await req(`/api/avatar/${gs.json.user.id}`)).type, "image/png");
check("picker picture served", (await req(`/api/avatar/guest/avataaars/x1`)).type, "image/png");
check("unknown style refused", (await req(`/api/avatar/guest/evil/x1`)).status, 404);
check("guest saves data", (await req("/api/v1/docs/basics", { cookie: gc, method: "PUT", body: { data: { done: ["goal"] }, baseVersion: 0 } })).status, 200);
const gme = await req("/api/v1/me", { cookie: gc });
check("guest me says guest", gme.json?.guest, true);
const silent = await req("/api/auth/sign-in/anonymous", { method: "POST", body: {} });
const sc = silent.setCookie.map((c) => c.split(";")[0]).join("; ");
check("a first save makes a quiet guest called Guest", (await req("/api/v1/me", { cookie: sc })).json?.name, "Guest");
check("guest picks a picture later", (await req("/api/auth/update-user", { cookie: sc, method: "POST", body: { name: "Mia", image: "https://api.dicebear.com/9.x/open-peeps/png?seed=ab12" } })).status, 200);
check("only offered pictures", (await req("/api/auth/update-user", { cookie: sc, method: "POST", body: { image: "https://evil.example/x.png" } })).status, 400);
const made = await req("/api/v1/online", { cookie: gc, method: "POST", body: { tc: "5+0", color: "random" } });
check("guest creates a game", made.status, 201);

const anna = await testPlayer("Anna");
const ac = `${anna.cookie.name}=${anna.cookie.value}`;
const me = await req("/api/v1/me", { cookie: ac });
check("account me has tag", me.json?.tag, anna.tag);
check("account joins guest's game", (await req(`/api/v1/online/${made.json.code}/join`, { cookie: ac, method: "POST" })).status, 200);
const info = await req(`/api/online/${made.json.code}`);
check("game shows guest flag and ID", [info.json?.players?.w, info.json?.players?.b].some((p) => p?.guest && p.tag === gs.json.user.tag && p.name === "Lucky Star"), true);
check("game shows account tag", [info.json?.players?.w, info.json?.players?.b].some((p) => p?.tag === anna.tag), true);
check("rename refused when bad", (await req("/api/auth/update-user", { cookie: ac, method: "POST", body: { name: "<script>" } })).status, 400);
check("rename works", (await req("/api/auth/update-user", { cookie: ac, method: "POST", body: { name: "Anna K" } })).status, 200);
check("tag cannot be changed", (await req("/api/auth/update-user", { cookie: ac, method: "POST", body: { tag: "AAAAAAA" } })).status === 200 ? (await req("/api/v1/me", { cookie: ac })).json?.tag : anna.tag, anna.tag);
check("password sign-up gone", (await req("/api/auth/sign-up/email", { method: "POST", body: { email: "a@b.co", password: "xxxxxxxxx", name: "a" } })).status, 400);
check("username plugin gone", (await req("/api/auth/is-username-available", { method: "POST", body: { username: "abc" } })).status, 404);

// Saved data (accounts only), with versions so two devices cannot overwrite each other.
check("save settings (new)", (await req("/api/v1/docs/settings", { cookie: ac, method: "PUT", body: { data: { theme: "dark" }, baseVersion: 0 } })).status, 200);
check("save settings (v1)", (await req("/api/v1/docs/settings", { cookie: ac, method: "PUT", body: { data: { theme: "light" }, baseVersion: 1 } })).status, 200);
const stale = await req("/api/v1/docs/settings", { cookie: ac, method: "PUT", body: { data: { theme: "blue" }, baseVersion: 1 } });
check("stale save is a conflict", stale.status, 409);
check("the conflict returns the current copy", JSON.stringify(stale.json).includes('"theme":"light"'), true);
check("unknown record refused", (await req("/api/v1/docs/secrets", { cookie: ac })).status, 400);
check("save a game", (await req("/api/v1/games/g1", { cookie: ac, method: "PUT", body: { game: { id: "g1", pgn: "1. e4 e5", savedAt: 1700000000000 } } })).status, 200);
check("the game is listed", JSON.stringify((await req("/api/v1/games", { cookie: ac })).json).includes('"id":"g1"'), true);
check("mismatched game id refused", (await req("/api/v1/games/g2", { cookie: ac, method: "PUT", body: { game: { id: "g9" } } })).status, 400);
check("save a review", (await req("/api/v1/reviews/g1", { cookie: ac, method: "PUT", body: { review: { gameId: "g1", accuracy: 90 } } })).status, 200);
check("delete the game", (await req("/api/v1/games/g1", { cookie: ac, method: "DELETE" })).status, 204);
check("its review went with it", (await req("/api/v1/reviews/g1", { cookie: ac })).json?.review, null);
const evil = await fetch(API + "/api/v1/docs/settings", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "PUT" } });
check("other sites get no CORS", evil.headers.get("access-control-allow-origin"), null);
const forged = (origin) => fetch(API + "/api/v1/docs/settings", { method: "PUT", headers: { Cookie: ac, "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ data: {}, baseVersion: 2 }) });
check("a change from another site is refused", (await forged("https://evil.example")).status, 403);
check("a change with no Origin is refused", (await forged(null)).status, 403);
check("sign out", (await req("/api/auth/sign-out", { cookie: ac, method: "POST", body: {} })).status, 200);
check("signed out", (await req("/api/v1/me", { cookie: ac })).status, 401);

console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
