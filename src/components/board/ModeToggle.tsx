"use client";

import { Dumbbell, Eye } from "lucide-react";
import { cx } from "@/components/ui/primitives";

export type LearnMode = "watch" | "practice";

/** The shared Watch | Practice switch used by openings and endgames. */
export function ModeToggle({ value, onChange }: { value: LearnMode; onChange: (m: LearnMode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode">
      {(
        [
          ["watch", "Watch", Eye],
          ["practice", "Practice", Dumbbell],
        ] as const
      ).map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={cx(
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
            value === id ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
          )}
        >
          <Icon className="size-4" aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}
