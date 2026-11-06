"use client";

import { type ElementType, type ReactNode, useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * Fades and lifts its content into place the first time it scrolls into view. Content that is already on screen
 * when the page loads stays put (no flash), and nothing is ever hidden for visitors who asked for less motion or
 * whose browser cannot observe scrolling.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"visible" | "hidden" | "shown">("visible");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already in view
    setState("hidden");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} data-reveal={state} style={delay ? { transitionDelay: `${delay}ms` } : undefined} className={cx("reveal", className)}>
      {children}
    </Tag>
  );
}
