import { describe, expect, it } from "vitest";
import { makePicker, standingClause, standingSentence } from "@/lib/review/phrases";

const cp = (value: number) => ({ kind: "cp" as const, value });
const pick = makePicker("test-seed");

describe("standingSentence", () => {
  it("says nothing when the standing did not change", () => {
    expect(standingSentence(cp(10), cp(-20), "w", pick)).toBe(""); // balanced → balanced
    expect(standingSentence(cp(220), cp(180), "w", pick)).toBe(""); // clear advantage → clear advantage
    expect(standingSentence(cp(-300), cp(-250), "b", pick)).toBe(""); // Black: clear edge → clear edge
  });

  it("describes the new standing only when it changes", () => {
    const text = standingSentence(cp(260), cp(10), "w", pick);
    expect(text).toContain("you have a clear advantage");
    const swing = standingSentence(cp(-10), cp(300), "w", pick);
    expect(swing).toContain("the position is balanced");
  });

  it("is deterministic for the same position", () => {
    expect(standingSentence(cp(500), cp(0), "w", makePicker("a"))).toBe(standingSentence(cp(500), cp(0), "w", makePicker("a")));
  });

  it("treats mate scores as their own standing", () => {
    expect(standingClause({ kind: "mate", value: 3 }, "w")).toBe("you have a forced checkmate");
    expect(standingSentence({ kind: "mate", value: 3 }, cp(500), "w", pick)).toContain("forced checkmate");
  });
});
