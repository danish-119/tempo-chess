"use client";

import { type RefObject, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * How far through a tall "scene" section the reader has scrolled while its sticky stage is pinned:
 * 0 when the section's top reaches the top of the screen, 1 when its bottom reaches the bottom.
 */
export function sceneProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport;
  return travel <= 0 ? 0 : clamp01(-top / travel);
}

/** Which of `steps` equal slices of the scroll `progress` is active. */
export function stepFromProgress(progress: number, steps: number): number {
  return Math.min(steps - 1, Math.floor(clamp01(progress) * steps));
}

/** Progress of an element travelling up the screen: 0 while its top is at `startAt` of the viewport height, 1 at `endAt`. */
export function elementProgress(top: number, viewport: number, startAt: number, endAt: number): number {
  const from = viewport * startAt;
  const to = viewport * endAt;
  return from === to ? 0 : clamp01((from - top) / (from - to));
}

const REDUCED = "(prefers-reduced-motion: reduce)";

/** True when the visitor asked for less motion: scenes then show their finished state and nothing animates. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(REDUCED);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}


function useScrollValue<T extends HTMLElement>(compute: (el: T) => number): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const next = Math.round(compute(el) * 200) / 200; // 200 steps keep re-renders cheap
      setValue((prev) => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [compute]);
  return [ref, value];
}

const computeScene = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return sceneProgress(r.top, r.height, window.innerHeight);
};

/** Scroll progress (0..1) through a tall section; attach the ref to the section that contains the sticky stage. */
export function useSceneProgress<T extends HTMLElement>() {
  return useScrollValue<T>(computeScene);
}

/** Progress (0..1) of an element as it travels up through the screen. */
export function useElementProgress<T extends HTMLElement>(startAt = 0.9, endAt = 0.4) {
  const compute = useCallback((el: T) => elementProgress(el.getBoundingClientRect().top, window.innerHeight, startAt, endAt), [startAt, endAt]);
  return useScrollValue<T>(compute);
}
