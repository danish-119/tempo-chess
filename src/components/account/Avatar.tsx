"use client";

import { useState } from "react";
import { cx } from "@/components/ui/primitives";

/** A steady colour per name, so a player's letter avatar always looks the same. */
const HUES = [18, 38, 145, 168, 200, 225, 262, 290, 330, 350];
function hueFor(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

/**
 * The player's picture: their Google photo when they have one, otherwise the first letter of their name on a
 * colour that belongs to that name.
 */
export function Avatar({ name, image, size = 32, className }: { name: string; image?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  if (image && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar from the sign-in provider; the site is a static export
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={cx("shrink-0 rounded-full object-cover ring-1 ring-border", className)}
        style={style}
      />
    );
  }
  const hue = hueFor(name);
  return (
    <span
      aria-hidden
      className={cx("inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-1 ring-black/10", className)}
      style={{ ...style, background: `oklch(0.58 0.13 ${hue})` }}
    >
      {letter}
    </span>
  );
}
