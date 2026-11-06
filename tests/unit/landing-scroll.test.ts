import { describe, expect, it } from "vitest";
import { clamp01, elementProgress, sceneProgress, stepFromProgress } from "@/components/landing/scroll";

describe("sceneProgress", () => {
  // A 4000px section in an 800px window has 3200px of pinned travel.
  it("is 0 until the section reaches the top, then follows the scroll, and is 1 at the end", () => {
    expect(sceneProgress(300, 4000, 800)).toBe(0); // not reached yet
    expect(sceneProgress(0, 4000, 800)).toBe(0);
    expect(sceneProgress(-1600, 4000, 800)).toBeCloseTo(0.5);
    expect(sceneProgress(-3200, 4000, 800)).toBe(1);
    expect(sceneProgress(-5000, 4000, 800)).toBe(1); // scrolled past
  });
  it("is 0 for a section that is not taller than the window", () => {
    expect(sceneProgress(-100, 800, 800)).toBe(0);
    expect(sceneProgress(-100, 500, 800)).toBe(0);
  });
});

describe("stepFromProgress", () => {
  it("splits the scroll into equal steps and never overruns", () => {
    expect([0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 1].map((p) => stepFromProgress(p, 4))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(stepFromProgress(-1, 4)).toBe(0);
    expect(stepFromProgress(7, 4)).toBe(3);
  });
});

describe("elementProgress", () => {
  it("runs from 0 to 1 as an element travels between two heights of the window", () => {
    // starts at 90% of an 1000px window, ends at 40%
    expect(elementProgress(900, 1000, 0.9, 0.4)).toBe(0);
    expect(elementProgress(650, 1000, 0.9, 0.4)).toBeCloseTo(0.5);
    expect(elementProgress(400, 1000, 0.9, 0.4)).toBe(1);
    expect(elementProgress(1200, 1000, 0.9, 0.4)).toBe(0); // below the start
    expect(elementProgress(0, 1000, 0.9, 0.4)).toBe(1); // above the end
  });
  it("does not divide by zero", () => {
    expect(elementProgress(500, 1000, 0.5, 0.5)).toBe(0);
  });
});

describe("clamp01", () => {
  it("limits to the unit range", () => {
    expect([clamp01(-3), clamp01(0.4), clamp01(9)]).toEqual([0, 0.4, 1]);
  });
});
