"use client";

import { cx } from "@/components/ui/primitives";
import { useElementProgress, useReducedMotion } from "./scroll";

/** A statement whose words light up one by one as it scrolls up the screen. The full text is always in the page. */
export function WordReveal({ text, className }: { text: string; className?: string }) {
  const [ref, progress] = useElementProgress<HTMLParagraphElement>(0.88, 0.38);
  const reduced = useReducedMotion();
  const words = text.split(" ");
  const lit = reduced ? words.length : Math.ceil(progress * words.length * 1.1);
  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => (
        <span key={i} className={cx("transition-colors duration-300", i < lit ? "text-ink" : "text-ink-3")}>
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
