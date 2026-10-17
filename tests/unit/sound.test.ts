import { describe, expect, it } from "vitest";
import { playSound, soundForSan } from "@/lib/sound";

describe("sounds", () => {
  it("picks the sound from SAN", () => {
    expect(soundForSan("e4")).toBe("move");
    expect(soundForSan("Nxe5")).toBe("capture");
    expect(soundForSan("Qh5+")).toBe("check");
    expect(soundForSan("Qxf7#")).toBe("game-end");
    expect(soundForSan("O-O-O")).toBe("castle");
    expect(soundForSan("e8=Q")).toBe("promote");
  });

  it("is a silent no-op without Web Audio (e.g. jsdom) or at zero volume", () => {
    expect(() => playSound("move", 0.5)).not.toThrow();
    expect(() => playSound("move", 0)).not.toThrow();
  });
});
