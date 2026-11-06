import { type Score, forPlayer } from "@/lib/engine/score";
import type { Color } from "@/lib/chess/types";
import { hashString } from "@/lib/utils/hash";

/**
 * Wording variety for the explainer. Phrases are chosen by hashing the
 * position and move, so the same move always gets the same sentence (saved
 * reviews never change between visits) while different moves read differently.
 */
export type Picker = <T>(key: string, options: readonly T[]) => T;

export function makePicker(seed: string): Picker {
  return (key, options) => {
    const n = parseInt(hashString(`${seed}|${key}`), 36);
    return options[Math.abs(n) % options.length];
  };
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Where the position stands for `player`, as a short clause ("you hold a small edge"). */
export function standingClause(score: Score, player: Color): string {
  const s = forPlayer(score, player);
  if (s.kind === "mate") {
    if (s.value > 0) return "you have a forced checkmate";
    if (s.value < 0) return "you are facing a forced checkmate";
    return "";
  }
  const cp = s.value;
  if (cp >= 400) return "you are winning";
  if (cp >= 150) return "you have a clear advantage";
  if (cp >= 50) return "you hold a small edge";
  if (cp > -50) return "the position is balanced";
  if (cp > -150) return "you are slightly worse";
  if (cp > -400) return "you are clearly worse";
  return "you are in serious trouble";
}

/**
 * A sentence about where the position stands, but only when that has changed
 * because of this move (for example from balanced to a clear advantage).
 * Saying "the position is balanced" after every quiet move is just noise, so
 * an unchanged standing returns an empty string.
 */
export function standingSentence(after: Score, before: Score, player: Color, pick: Picker): string {
  const clause = standingClause(after, player);
  if (!clause || clause === standingClause(before, player)) return "";
  return capitalise(
    pick("standing", [`now ${clause}.`, `this changes things: ${clause}.`, `as a result, ${clause}.`, `after this, ${clause}.`]),
  );
}
