import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LichessError,
  assertLichessUrl,
  fetchLichessGame,
  fetchLichessMonthGames,
  importLichessGame,
  lichessMonths,
  normalizeLichessUsername,
  outcomeFor,
  parseLichessGameUrl,
  parseLichessNdjson,
} from "@/lib/lichess/client";
import { __resetStorageForTests } from "@/lib/storage/db";

const PGN = `[Event "rated blitz game"]\n[Site "https://lichess.org/PndlSDZg"]\n[White "thibault"]\n[Black "Pehachzed"]\n[Result "0-1"]\n[WhiteElo "1749"]\n[BlackElo "1800"]\n[TimeControl "300+3"]\n\n1. e4 { [%clk 0:05:00] } 1... c5 { [%clk 0:05:00] } 2. Nf3 { [%clk 0:05:01] } 0-1\n`;
const LINE = JSON.stringify({
  id: "PndlSDZg",
  rated: true,
  variant: "standard",
  speed: "blitz",
  createdAt: 1791813887348,
  lastMoveAt: 1791814483311,
  status: "resign",
  winner: "black",
  players: { white: { user: { name: "thibault" }, rating: 1749 }, black: { user: { name: "Pehachzed" }, rating: 1800 } },
  opening: { eco: "B44", name: "Sicilian Defense: Taimanov Variation" },
  pgn: PGN,
});

describe("Lichess validation", () => {
  it("normalises usernames and profile links", () => {
    expect(normalizeLichessUsername(" Thibault ")).toBe("thibault");
    expect(normalizeLichessUsername("https://lichess.org/@/DrNykterstein")).toBe("drnykterstein");
    expect(() => normalizeLichessUsername("x")).toThrowError(LichessError);
    expect(() => normalizeLichessUsername("bad name")).toThrowError(LichessError);
  });

  it("only allows the Lichess API", () => {
    expect(() => assertLichessUrl("https://lichess.org/api/user/x")).not.toThrow();
    expect(() => assertLichessUrl("https://lichess.org/game/export/abcdefgh")).not.toThrow();
    expect(() => assertLichessUrl("https://lichess.org/account")).toThrow();
    expect(() => assertLichessUrl("https://evil.com/api/user/x")).toThrow();
    expect(() => assertLichessUrl("http://lichess.org/api/user/x")).toThrow();
  });

  it("recognises game links (with or without player suffix / side)", () => {
    expect(parseLichessGameUrl("https://lichess.org/PndlSDZg")).toBe("PndlSDZg");
    expect(parseLichessGameUrl("https://lichess.org/PndlSDZgAbCd")).toBe("PndlSDZg");
    expect(parseLichessGameUrl("https://lichess.org/PndlSDZg/black")).toBe("PndlSDZg");
    expect(parseLichessGameUrl("https://lichess.org/@/thibault")).toBeNull();
    expect(parseLichessGameUrl("https://evil.com/PndlSDZg")).toBeNull();
  });

  it("builds months newest first", () => {
    const months = lichessMonths(Date.UTC(2026, 7, 15), new Date(Date.UTC(2026, 9, 3)));
    expect(months.map((m) => `${m.year}-${m.month}`)).toEqual(["2026-10", "2026-9", "2026-8"]);
    expect(months[0].until).toBe(Date.UTC(2026, 10, 1) - 1);
  });

  it("maps outcomes", () => {
    expect(outcomeFor("black", "resign", "b")).toBe("win");
    expect(outcomeFor("black", "mate", "w")).toBe("loss");
    expect(outcomeFor(undefined, "draw", "w")).toBe("draw");
    expect(outcomeFor(undefined, "aborted", "w")).toBeNull();
  });
});

describe("Lichess games", () => {
  beforeEach(() => __resetStorageForTests());
  afterEach(() => vi.restoreAllMocks());

  it("parses NDJSON and skips variants / junk", () => {
    const variant = JSON.stringify({ ...JSON.parse(LINE), id: "x", variant: "chess960" });
    const { games, skipped } = parseLichessNdjson(`${LINE}\n${variant}\nnot json\n`, "pehachzed");
    expect(games).toHaveLength(1);
    expect(skipped).toBe(2);
    expect(games[0]).toMatchObject({ userColor: "b", outcome: "win", timeClass: "blitz", openingName: "Sicilian Defense: Taimanov Variation" });
    const imported = importLichessGame(games[0]);
    expect(imported.source).toBe("lichess");
    expect(imported.metadata.link).toBe("https://lichess.org/PndlSDZg");
    expect(imported.moves[0].clockSeconds).toBe(300);
  });

  it("fetches a month of games", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`${LINE}\n`, { status: 200 }));
    const res = await fetchLichessMonthGames("thibault", lichessMonths(Date.UTC(2026, 9, 1), new Date(Date.UTC(2026, 9, 20)))[0]);
    expect(res.games[0].userColor).toBe("w");
  });

  it("fetches a single game by link id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(PGN, { status: 200 }));
    const g = await fetchLichessGame("PndlSDZg");
    expect(g.moves.map((m) => m.san)).toEqual(["e4", "c5", "Nf3"]);
  });

  it("maps 404 to NOT_FOUND", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"error":"Not found"}', { status: 404 }));
    await expect(fetchLichessGame("ZZZZZZZZ")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
