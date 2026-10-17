import { describe, expect, it } from "vitest";
import {
  cleanComment,
  parseClock,
  parsePgnDatabase,
  parseSingleGame,
  safeLink,
  splitPgnGames,
  timeClassFromControl,
} from "@/lib/chess/pgn";
import { PgnParseError, START_FEN } from "@/lib/chess/types";

const SCHOLARS = `[Event "Casual"]
[Site "Local"]
[Date "2024.01.02"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[WhiteElo "1500"]
[TimeControl "300+2"]

1. e4 {[%clk 0:05:00]} e5 {[%clk 0:04:58]} 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7# 1-0`;

describe("splitPgnGames", () => {
  it("splits multi-game databases on tag sections", () => {
    const two = `${SCHOLARS}\n\n[Event "Second"]\n[White "C"]\n[Black "D"]\n[Result "*"]\n\n1. d4 d5 *`;
    expect(splitPgnGames(two)).toHaveLength(2);
  });

  it("handles CRLF, BOM and a game without headers", () => {
    expect(splitPgnGames("﻿1. e4 e5 *\r\n")).toHaveLength(1);
  });
});

describe("parseSingleGame", () => {
  it("parses headers, moves, FENs, clocks and comments", () => {
    const g = parseSingleGame(SCHOLARS);
    expect(g.metadata.white).toBe("Alice");
    expect(g.metadata.whiteElo).toBe(1500);
    expect(g.metadata.result).toBe("1-0");
    expect(g.metadata.timeClass).toBe("blitz");
    expect(g.moves).toHaveLength(7);
    expect(g.moves[6].san).toBe("Qxf7#");
    expect(g.moves[6].uci).toBe("h5f7");
    expect(g.moves[6].captured).toBe("p");
    expect(g.moves[0].clockSeconds).toBe(300);
    expect(g.moves[1].clockSeconds).toBe(298);
    expect(g.moves[0].comment).toBeUndefined(); // only a clock command
    expect(g.moves[0].fenBefore).toBe(START_FEN);
    expect(g.moves[1].moveNumber).toBe(1);
    expect(g.moves[2].moveNumber).toBe(2);
    expect(g.startFen).toBe(START_FEN);
    expect(g.customStart).toBe(false);
  });

  it("ignores variations, NAGs and line comments", () => {
    const g = parseSingleGame(`[Result "*"]\n\n1. e4 $1 (1. d4 d5 (1... Nf6)) e5 ; comment\n2. Nf3 {a {nested?} *`);
    expect(g.moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3"]);
  });

  it("supports custom start positions via the FEN tag", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 b - - 0 40";
    const g = parseSingleGame(`[SetUp "1"]\n[FEN "${fen}"]\n[Result "*"]\n\n40... Kd7 41. e4 *`);
    expect(g.customStart).toBe(true);
    expect(g.startFen).toBe(fen);
    expect(g.moves[0].color).toBe("b");
    expect(g.moves[0].moveNumber).toBe(40);
    expect(g.moves[1].moveNumber).toBe(41);
  });

  it("handles promotion", () => {
    const g = parseSingleGame(`[SetUp "1"]\n[FEN "8/P6k/8/8/8/8/8/K7 w - - 0 1"]\n\n1. a8=Q *`);
    expect(g.moves[0].promotion).toBe("q");
    expect(g.moves[0].uci).toBe("a7a8q");
  });

  it("infers the result of a checkmate when the tag is missing", () => {
    const g = parseSingleGame("1. f3 e5 2. g4 Qh4#");
    expect(g.metadata.result).toBe("0-1");
  });

  it("rejects illegal moves with a typed error", () => {
    expect(() => parseSingleGame("1. e4 e5 2. Ke3 Ke6 3. Qh8")).toThrowError(PgnParseError);
  });

  it("rejects an invalid FEN tag", () => {
    try {
      parseSingleGame(`[FEN "not a fen"]\n\n1. e4 *`);
      expect.unreachable();
    } catch (e) {
      expect((e as PgnParseError).code).toBe("INVALID_FEN");
    }
  });

  it("rejects unsupported variants", () => {
    try {
      parseSingleGame(`[Variant "Chess960"]\n\n1. e4 *`);
      expect.unreachable();
    } catch (e) {
      expect((e as PgnParseError).code).toBe("UNSUPPORTED_VARIANT");
    }
  });

  it("produces stable ids", () => {
    expect(parseSingleGame(SCHOLARS).id).toBe(parseSingleGame(SCHOLARS).id);
  });

  it("keeps an incomplete game", () => {
    const g = parseSingleGame("1. e4 e5 2. Nf3");
    expect(g.moves).toHaveLength(3);
    expect(g.metadata.result).toBe("*");
  });
});

describe("parsePgnDatabase", () => {
  it("collects per-game errors without aborting", () => {
    const res = parsePgnDatabase(`${SCHOLARS}\n\n[Event "bad"]\n\n1. e4 e5 2. Qxf7 *`);
    expect(res.games).toHaveLength(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].gameIndex).toBe(1);
  });

  it("rejects empty input", () => {
    expect(() => parsePgnDatabase("   ")).toThrowError(/Paste or upload/);
  });
});

describe("helpers", () => {
  it("parses clocks", () => {
    expect(parseClock("[%clk 1:02:03.5]")).toBeCloseTo(3723.5);
    expect(parseClock("no clock")).toBeUndefined();
  });

  it("cleans comments", () => {
    expect(cleanComment("[%clk 0:01:00] good  move [%eval 0.3]")).toBe("good move");
  });

  it("classifies time controls", () => {
    expect(timeClassFromControl("60")).toBe("bullet");
    expect(timeClassFromControl("180+2")).toBe("blitz");
    expect(timeClassFromControl("600")).toBe("rapid");
    expect(timeClassFromControl("1800")).toBe("classical");
    expect(timeClassFromControl("1/86400")).toBe("daily");
    expect(timeClassFromControl("-")).toBeUndefined();
  });

  it("only keeps http(s) links", () => {
    expect(safeLink("javascript:alert(1)")).toBeUndefined();
    expect(safeLink("https://www.chess.com/game/live/1")).toBe("https://www.chess.com/game/live/1");
  });
});
