"use client";

import { Crown, Flag, Puzzle as PuzzleIcon, Sparkles, Swords } from "lucide-react";
import { PieceImage, type PieceLetter } from "@/components/learn/PieceImage";
import { Button, cx } from "@/components/ui/primitives";
import { LEVELS } from "@/lib/puzzles";

type LevelId = (typeof LEVELS)[number]["id"];
interface ThemeOption {
  id: string;
  label: string;
  count: number;
}

/** Each level gets a piece, from the humble pawn to the queen; "any level" gets the king. */
const LEVEL_LOOK: Record<LevelId, { piece: PieceLetter; range: string }> = {
  beginner: { piece: "P", range: "up to 1000" },
  intermediate: { piece: "N", range: "1000 to 1600" },
  advanced: { piece: "R", range: "1600 to 2200" },
  expert: { piece: "Q", range: "2200 and up" },
  any: { piece: "K", range: "a mix of all" },
};

const TACTICS = new Set([
  "fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "hangingPiece", "trappedPiece", "deflection", "attraction",
  "capturingDefender", "clearance", "interference", "intermezzo", "xRayAttack", "sacrifice", "quietMove", "zugzwang",
  "defensiveMove", "exposedKing", "kingsideAttack", "queensideAttack", "advancedPawn", "promotion", "underPromotion",
]);

function groupOf(id: string): "Checkmates" | "Endgames" | "Tactics" | "More" {
  if (/mate/i.test(id)) return "Checkmates";
  if (/endgame/i.test(id)) return "Endgames";
  if (TACTICS.has(id)) return "Tactics";
  return "More";
}
const GROUP_ICON = { Tactics: Swords, Checkmates: Crown, Endgames: Flag, More: Sparkles } as const;

/**
 * Choosing what to solve, laid out like the Basics course: pick a level (each one a medallion with its piece),
 * then a theme from tiles grouped into tactics, checkmates and endgames. Both are kept in the address.
 */
export function PuzzlePicker({
  levelId,
  theme,
  themes,
  onLevel,
  onTheme,
  onStart,
}: {
  levelId: LevelId;
  theme: string;
  themes: ThemeOption[];
  onLevel: (id: LevelId) => void;
  onTheme: (id: string) => void;
  onStart: () => void;
}) {
  const groups = (["Tactics", "Checkmates", "Endgames", "More"] as const)
    .map((g) => ({ g, items: themes.filter((t) => groupOf(t.id) === g).sort((a, b) => b.count - a.count) }))
    .filter((x) => x.items.length);
  const total = themes.reduce((n, t) => Math.max(n, t.count), 0);

  return (
    <div className="space-y-6">
      <section aria-labelledby="level-h" className="space-y-3">
        <h2 id="level-h" className="eyebrow">
          1 · Your level
        </h2>
        <div className="grid grid-cols-5 gap-2 sm:gap-3" role="radiogroup" aria-label="Level">
          {LEVELS.map((l) => {
            const on = levelId === l.id;
            const look = LEVEL_LOOK[l.id];
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${l.label}, ${look.range}`}
                onClick={() => onLevel(l.id)}
                className="group flex flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={cx(
                    "grid size-14 place-items-center rounded-full border-b-4 transition-all sm:size-20",
                    on
                      ? "border-[color-mix(in_oklch,var(--accent),black_30%)] bg-accent shadow-[0_0_0_4px_var(--accent-soft)]"
                      : "border-border bg-surface-2 group-hover:-translate-y-0.5",
                  )}
                  aria-hidden
                >
                  <PieceImage piece={look.piece} color={on ? "w" : "b"} className="size-8 text-[28px] sm:size-11 sm:text-[38px]" />
                </span>
                <span className={cx("text-xs font-semibold sm:text-sm", on ? "text-ink" : "text-ink-2")}>{l.label}</span>
                <span className="text-[10px] text-ink-3 max-sm:hidden">{look.range}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="theme-h" className="space-y-3">
        <h2 id="theme-h" className="eyebrow">
          2 · What to practise
        </h2>
        <div role="radiogroup" aria-label="Theme" className="space-y-4">
          <button
            type="button"
            role="radio"
            aria-checked={theme === ""}
            onClick={() => onTheme("")}
            className={cx(
              "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all sm:p-4",
              theme === "" ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border bg-surface hover:border-accent",
            )}
          >
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-ink" aria-hidden>
              <PuzzleIcon className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">Everything</span>
              <span className="block text-xs text-ink-3">A different idea every time{total ? "" : ""}</span>
            </span>
          </button>
          {groups.map(({ g, items }) => {
            const Icon = GROUP_ICON[g];
            return (
              <div key={g} className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
                  <Icon className="size-4 text-accent" aria-hidden /> {g}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={theme === t.id}
                      onClick={() => onTheme(t.id)}
                      className={cx(
                        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all hover:-translate-y-0.5",
                        theme === t.id ? "border-accent bg-accent-soft font-semibold ring-2 ring-accent" : "border-border bg-surface hover:border-accent",
                      )}
                    >
                      <span className="min-w-0 truncate">{t.label}</span>
                      <span className="shrink-0 font-mono text-[11px] text-ink-3">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 md:bottom-4">
        <Button variant="primary" className="h-12 w-full text-base shadow-[var(--shadow)]" onClick={onStart}>
          Start solving
        </Button>
      </div>
    </div>
  );
}
