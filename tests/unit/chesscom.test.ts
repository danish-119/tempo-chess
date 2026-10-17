import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChessComError,
  assertApiUrl,
  fetchArchives,
  fetchMonthGames,
  importChessComGame,
  normalizeUsername,
  openingFromEcoUrl,
  outcomeFromResult,
  parseChessComGameUrl,
} from "@/lib/chesscom/client";
import { __resetStorageForTests } from "@/lib/storage/db";

const month = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "chesscom-month.json"), "utf8"));

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

describe("validation", () => {
  it("normalises usernames and profile URLs", () => {
    expect(normalizeUsername("  Danish-119 ")).toBe("danish-119");
    expect(normalizeUsername("https://www.chess.com/member/Hikaru")).toBe("hikaru");
    expect(normalizeUsername("@magnus_c")).toBe("magnus_c");
  });

  it("rejects invalid usernames", () => {
    for (const bad of ["", "ab", "has space", "x".repeat(26), "../etc", "a/b"]) {
      expect(() => normalizeUsername(bad)).toThrowError(ChessComError);
    }
  });

  it("only allows api.chess.com/pub URLs", () => {
    expect(() => assertApiUrl("https://api.chess.com/pub/player/x")).not.toThrow();
    expect(() => assertApiUrl("https://evil.com/pub/player/x")).toThrow();
    expect(() => assertApiUrl("http://api.chess.com/pub/player/x")).toThrow();
    expect(() => assertApiUrl("https://api.chess.com.evil.com/pub/")).toThrow();
    expect(() => assertApiUrl("https://api.chess.com/private")).toThrow();
  });

  it("recognises game links", () => {
    expect(parseChessComGameUrl("https://www.chess.com/game/live/173851145610")).toEqual({ kind: "live", gameId: "173851145610" });
    expect(parseChessComGameUrl("https://www.chess.com/game/daily/123")).toEqual({ kind: "daily", gameId: "123" });
    expect(parseChessComGameUrl("https://evil.com/game/live/1")).toBeNull();
    expect(parseChessComGameUrl("javascript:alert(1)")).toBeNull();
  });

  it("maps results and opening URLs", () => {
    expect(outcomeFromResult("win")).toBe("win");
    expect(outcomeFromResult("repetition")).toBe("draw");
    expect(outcomeFromResult("resigned")).toBe("loss");
    expect(openingFromEcoUrl("https://www.chess.com/openings/Kings-Pawn-Opening-Kings-Knight-Variation")).toBe("Kings Pawn Opening Kings Knight Variation");
    expect(openingFromEcoUrl("https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3")).toBe("Sicilian Defense Najdorf Variation");
  });
});

describe("API client (mocked fetch)", () => {
  beforeEach(() => {
    __resetStorageForTests();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("parses archives newest first", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ archives: ["https://api.chess.com/pub/player/user1/games/2026/08", "https://api.chess.com/pub/player/user1/games/2026/09", "https://evil.com/x/games/2026/10"] }),
    );
    const archives = await fetchArchives("user1");
    expect(archives.map((a) => `${a.year}-${a.month}`)).toEqual(["2026-9", "2026-8"]);
  });

  it("parses a real Chess.com month (fixture) and imports a game", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(month));
    const res = await fetchMonthGames("danish-119", { url: "https://api.chess.com/pub/player/danish-119/games/2026/09", year: 2026, month: 9, label: "Sep" });
    expect(res.games.length).toBeGreaterThan(0);
    const g = res.games[0];
    expect(g.userColor).not.toBeNull();
    expect(["win", "loss", "draw"]).toContain(g.outcome);
    const imported = importChessComGame(g);
    expect(imported.moves.length).toBeGreaterThan(0);
    expect(imported.source).toBe("chesscom");
    expect(imported.moves.some((m) => m.clockSeconds !== undefined)).toBe(true);
    // Every game in the fixture parses.
    let failures = 0;
    for (const s of res.games) {
      try {
        importChessComGame(s);
      } catch {
        failures++;
      }
    }
    expect(failures).toBe(0);
  });

  it("maps 404 to NOT_FOUND", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: "not found" }, 404));
    await expect(fetchArchives("nobody-here")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("retries 429 and then succeeds", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 429, { "Retry-After": "0" }))
      .mockResolvedValueOnce(jsonResponse({ archives: [] }));
    await expect(fetchArchives("retry-user")).resolves.toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("caches responses", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ archives: [] }));
    await fetchArchives("cache-user");
    await fetchArchives("cache-user");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("reports a failing month as unavailable, not as a missing account", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ code: 0, message: "An internal error has occurred." }, 404));
    await expect(
      fetchMonthGames("magnuscarlsen", { url: "https://api.chess.com/pub/player/magnuscarlsen/games/2026/10", year: 2026, month: 10, label: "October 2026" }),
    ).rejects.toMatchObject({ code: "MONTH_UNAVAILABLE", message: expect.stringContaining("October 2026") });
  });

  it("reports network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchArchives("net-user")).rejects.toMatchObject({ code: "NETWORK" });
  });

  it("rejects schema changes instead of crashing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ unexpected: true }));
    await expect(fetchArchives("schema-user")).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });
});
