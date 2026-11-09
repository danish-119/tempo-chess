import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/lib/glossary";
import { GLOSSARY_DIAGRAMS } from "@/lib/glossary-diagrams";

describe("glossary diagrams", () => {
  it("belong to real terms and show real positions", () => {
    const ids = new Set(GLOSSARY.map((g) => g.id));
    for (const [id, d] of Object.entries(GLOSSARY_DIAGRAMS)) {
      expect(ids.has(id), `${id} is a glossary term`).toBe(true);
      expect(() => new Chess(d.fen), id).not.toThrow();
      expect(d.glow.length, id).toBeGreaterThan(0);
      for (const sq of d.glow) expect(sq, id).toMatch(/^[a-h][1-8]$/);
    }
  });

  it("the mate diagrams really are mate, and the stalemate diagram really is stalemate", () => {
    expect(new Chess(GLOSSARY_DIAGRAMS.checkmate.fen).isCheckmate()).toBe(true);
    expect(new Chess(GLOSSARY_DIAGRAMS["back-rank"].fen).isCheckmate()).toBe(true);
    expect(new Chess(GLOSSARY_DIAGRAMS["smothered-mate"].fen).isCheckmate()).toBe(true);
    expect(new Chess(GLOSSARY_DIAGRAMS.stalemate.fen).isStalemate()).toBe(true);
    expect(new Chess(GLOSSARY_DIAGRAMS.check.fen).inCheck()).toBe(true);
  });
});
