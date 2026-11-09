// End-to-end check of online play against a running local API (npm run dev):
// two signed-in players, one makes a game and the other joins with its code; it is played to checkmate over
// WebSockets with a spectator watching, and the result is recorded.
// Usage: node scripts/online-smoke.mjs
import { testPlayer } from "./test-player.mjs";

const API = process.env.API ?? "http://localhost:8787";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:3000";
let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? `: ${detail}` : ""}`);
  if (!cond) failed++;
};

class Client {
  cookies = new Map();
  cookie() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async req(path, { method = "GET", body } = {}) {
    const res = await fetch(API + path, {
      method,
      redirect: "manual",
      headers: { Origin: ORIGIN, Cookie: this.cookie(), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, headers: res.headers };
  }
  socket(path) {
    const ws = new WebSocket(API.replace(/^http/, "ws") + path, { headers: { Origin: ORIGIN, Cookie: this.cookie() } });
    const inbox = [];
    const waiters = [];
    ws.addEventListener("message", (e) => {
      const msg = typeof e.data === "string" && e.data.startsWith("{") ? JSON.parse(e.data) : e.data;
      inbox.push(msg);
      for (const w of [...waiters]) if (w.test(msg)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(msg);
      }
    });
    const open = new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    return {
      ws,
      open,
      inbox,
      send: (m) => ws.send(JSON.stringify(m)),
      next: (test, ms = 5000) =>
        new Promise((resolve, reject) => {
          const found = inbox.find(test);
          if (found) return resolve(found);
          const t = setTimeout(() => reject(new Error("timed out waiting for a message")), ms);
          waiters.push({ test, resolve: (m) => (clearTimeout(t), resolve(m)) });
        }),
    };
  }
}

async function player(prefix) {
  const p = await testPlayer(`${prefix}${`${Date.now()}`.slice(-6)}${Math.floor(Math.random() * 90 + 10)}`);
  const c = new Client();
  c.cookies.set(p.cookie.name, p.cookie.value);
  const me = await c.req("/api/v1/me");
  if (me.status !== 200) throw new Error(`not signed in: ${me.status}`);
  return { c, name: p.name, tag: p.tag };
}

const anna = await player("Anna");
const ben = await player("Ben");
const watcher = new Client();

const created = await anna.c.req("/api/v1/online", { method: "POST", body: { tc: "3+2", color: "w" } });
ok("Anna makes a game", created.status === 201, JSON.stringify(created.json));
const code = created.json?.code;
ok("the game has a short code and its own link", /^[A-Z2-9]{6}$/.test(code ?? "") && created.json?.url?.endsWith(`/play/game?code=${code}`));

const nobody = await new Client().req("/api/v1/online", { method: "POST", body: { tc: "3+2" } });
ok("making a game needs a sign-in (an account or a guest)", nobody.status === 401);
const self = await anna.c.req(`/api/v1/online/${code}/join`, { method: "POST" });
ok("you cannot join your own game", self.status === 409);

const joined = await ben.c.req(`/api/v1/online/${code}/join`, { method: "POST" });
ok("Ben joins with the code", joined.status === 200, JSON.stringify(joined.json));

const a = anna.c.socket(`/api/online/${code}/ws`);
const b = ben.c.socket(`/api/online/${code}/ws`);
const w = watcher.socket(`/api/online/${code}/ws`);
await Promise.all([a.open, b.open, w.open]);
const aState = await a.next((m) => m.t === "state");
const wState = await w.next((m) => m.t === "state");
ok("Anna plays White", aState.you === "w" && aState.status === "playing");
ok("a guest can watch", wState.you === "spectator");
const presence = await a.next((m) => m.t === "presence" && m.watching >= 1).catch(() => null);
ok("the players see someone watching", presence?.watching === 1);

w.send({ t: "move", uci: "e2e4", ply: 1 });
const refused = await w.next((m) => m.t === "error").catch(() => null);
ok("a spectator cannot move", refused?.code === "spectator");

b.send({ t: "move", uci: "e7e5", ply: 1 });
ok("Black cannot move first", (await b.next((m) => m.t === "error").catch(() => null))?.code === "illegal");

const moves = [
  [a, "f2f3"],
  [b, "e7e5"],
  [a, "g2g4"],
  [b, "d8h4"],
];
for (const [i, [who, uci]] of moves.entries()) {
  who.send({ t: "move", uci, ply: i + 1 });
  await w.next((m) => m.t === "move" && m.ply === i + 1);
}
ok("every move reaches the spectator", w.inbox.filter((m) => m.t === "move").length === 4);
const dup = a.inbox.length;
a.send({ t: "move", uci: "f2f3", ply: 1 }); // a stale retry
await a.next((m, i = a.inbox.indexOf(m)) => i >= dup && m.t === "state").catch(() => null);
const end = await w.next((m) => m.t === "state" && m.status === "ended");
ok("checkmate ends the game for everyone", end.result?.result === "0-1" && end.result?.reason === "checkmate");

await new Promise((res) => setTimeout(res, 500));
const info = await watcher.req(`/api/online/${code}`);
ok("the finished game can still be looked at", info.status === 200 && info.json?.sans?.join(" ") === "f3 e5 g4 Qh4#");

const evil = new WebSocket(API.replace(/^http/, "ws") + `/api/online/${code}/ws`, { headers: { Origin: "https://evil.example" } });
const evilOpened = await new Promise((res) => {
  evil.addEventListener("open", () => res(true), { once: true });
  evil.addEventListener("error", () => res(false), { once: true });
});
ok("game sockets refuse other websites", evilOpened === false);

for (const s of [a, b, w]) s.ws.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
