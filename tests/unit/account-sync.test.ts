import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushDocs, loadDocs, readDoc, writeDoc } from "@/lib/account/docs";
import { setAccount } from "@/lib/account/session";
import { parseSingleGame } from "@/lib/chess/pgn";
import { getProgress, listGames, saveGame, updateProgress } from "@/lib/storage/db";

/**
 * The signed-in path: records and games go to the account API. A small fake server stands in for it, with the
 * same version rules (a save based on an old version gets 409 with the current copy).
 */
const game = parseSingleGame(`[White "me"]\n[Black "opp"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`);

interface FakeDoc {
  data: unknown;
  version: number;
}

function fakeServer() {
  const docs = new Map<string, FakeDoc>();
  const games = new Map<string, unknown>();
  const calls: { method: string; path: string; body?: unknown }[] = [];
  let offline = false;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (offline) throw new TypeError("Failed to fetch");
    const path = new URL(url).pathname;
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
    if (path === "/api/v1/docs" && method === "GET") return json(200, { docs: [...docs].map(([key, d]) => ({ key, ...d })) });
    const docMatch = path.match(/^\/api\/v1\/docs\/(\w+)$/);
    if (docMatch && method === "PUT") {
      const cur = docs.get(docMatch[1]);
      if ((cur?.version ?? 0) !== body.baseVersion) return json(409, { error: { code: "conflict", message: "Changed elsewhere." }, current: cur ?? null });
      const next = { data: body.data, version: (cur?.version ?? 0) + 1 };
      docs.set(docMatch[1], next);
      return json(200, { version: next.version });
    }
    const gameMatch = path.match(/^\/api\/v1\/games\/(.+)$/);
    if (gameMatch && method === "PUT") {
      games.set(decodeURIComponent(gameMatch[1]), body.game);
      return json(200, { ok: true });
    }
    if (path === "/api/v1/games" && method === "GET") return json(200, { games: [...games.values()], next: null });
    return json(404, { error: { code: "not_found", message: "Not found." } });
  });
  return {
    docs,
    games,
    calls,
    fetchMock,
    setOffline: (v: boolean) => {
      offline = v;
    },
  };
}

const player = { id: "u1", email: "a@b.c", name: "Anna", image: null, tag: "AAAAAAA", guest: false };

describe("account sync", () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(async () => {
    vi.useFakeTimers();
    server = fakeServer();
    vi.stubGlobal("fetch", server.fetchMock);
    server.docs.set("settings", { data: { theme: "dark" }, version: 3 });
    setAccount({ status: "user", player });
    await loadDocs();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads the account's records after sign-in", () => {
    expect(readDoc("settings", null)).toEqual({ theme: "dark" });
  });

  it("saves a change shortly after it is made, naming the version it was based on", async () => {
    writeDoc("settings", { theme: "light" });
    writeDoc("settings", { theme: "blue" }); // quick changes are saved once
    await vi.advanceTimersByTimeAsync(500);
    const puts = server.calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0].body).toEqual({ data: { theme: "blue" }, baseVersion: 3 });
    expect(server.docs.get("settings")).toEqual({ data: { theme: "blue" }, version: 4 });
  });

  it("when another device saved first, it rebases on the newer version instead of failing", async () => {
    server.docs.set("settings", { data: { theme: "green" }, version: 7 }); // another device
    writeDoc("settings", { theme: "light" });
    await vi.advanceTimersByTimeAsync(500);
    expect(server.docs.get("settings")).toEqual({ data: { theme: "light" }, version: 8 });
  });

  it("progress goes through the account too", async () => {
    await updateProgress((p) => ({ ...p, rating: { value: 1234, games: 5 } }));
    await flushDocs();
    expect((server.docs.get("progress")?.data as { rating: { value: number } }).rating.value).toBe(1234);
    expect((await getProgress()).rating.value).toBe(1234);
  });

  it("saves games to the account", async () => {
    await saveGame(game);
    expect(server.games.has(game.id)).toBe(true);
    expect((await listGames()).map((g) => g.id)).toEqual([game.id]);
  });

  it("offline, a game waits and is saved when the connection comes back", async () => {
    server.setOffline(true);
    await saveGame(game); // does not throw: bots and the coach work offline
    expect(server.games.has(game.id)).toBe(false);
    server.setOffline(false);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(10);
    expect(server.games.has(game.id)).toBe(true);
  });

  it("offline, a record change is saved when the connection comes back", async () => {
    server.setOffline(true);
    writeDoc("settings", { theme: "light" });
    await vi.advanceTimersByTimeAsync(500);
    server.setOffline(false);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(10);
    expect(server.docs.get("settings")?.data).toEqual({ theme: "light" });
  });
});

describe("guests", () => {
  it("keep nothing anywhere but memory, and never call the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await saveGame(game);
    writeDoc("settings", { theme: "light" });
    await flushDocs();
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await listGames()).map((g) => g.id)).toEqual([game.id]);
    vi.unstubAllGlobals();
  });
});
