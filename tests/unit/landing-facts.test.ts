import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { FACTS } from "@/content/landing";
import { KEY_PLIES, OPERA, OPERA_PLIES, operaFen, operaLabel, operaScore } from "@/content/opera-review";
import puzzles from "@/data/puzzles.json";
import { ENDGAME_LESSONS } from "@/lib/endgames";
import { GLOSSARY } from "@/lib/glossary";
import { OPENINGS } from "@/lib/learn/openings";
import { TACTICS } from "@/lib/learn/tactics";
import { PLAY_LEVELS } from "@/lib/play";

describe("the landing page only states true numbers", () => {
  it("matches the data each figure describes", () => {
    expect(FACTS.bots).toBe(PLAY_LEVELS.length);
    expect(FACTS.puzzles).toBe(puzzles.length);
    expect(FACTS.endgames).toBe(ENDGAME_LESSONS.length);
    expect(FACTS.openings).toBe(OPENINGS.length);
    expect(FACTS.tactics).toBe(TACTICS.length);
    expect(FACTS.glossaryTerms).toBe(GLOSSARY.length);
  });
});

describe("the Opera Game fixture helpers", () => {
  it("replays to the final position and labels moves in standard notation", () => {
    expect(OPERA_PLIES).toBe(33);
    expect(new Chess(operaFen(OPERA_PLIES)).isCheckmate()).toBe(true);
    expect(operaLabel(0)).toBe("Start position");
    expect(operaLabel(1)).toBe("1. e4");
    expect(operaLabel(2)).toBe("1… e5");
    expect(operaLabel(OPERA_PLIES)).toBe("17. Rd8#");
  });

  it("has an evaluation for every position, ending in mate", () => {
    expect(OPERA.positions).toHaveLength(OPERA_PLIES + 1);
    expect(operaScore(OPERA_PLIES)).toEqual({ kind: "mate", value: 0 });
    expect(operaScore(999)).toEqual(operaScore(OPERA_PLIES)); // clamped
    expect(operaScore(-4)).toEqual(operaScore(0));
  });

  it("picks the memorable moments from the real grades", () => {
    expect(KEY_PLIES.length).toBeGreaterThanOrEqual(3);
    expect(KEY_PLIES).toEqual([...KEY_PLIES].sort((a, b) => a - b));
    expect(KEY_PLIES).toContain(OPERA_PLIES);
    for (const p of KEY_PLIES.slice(0, -1)) expect(["brilliant", "mistake", "blunder"]).toContain(OPERA.moves[p - 1].cls);
  });
});
