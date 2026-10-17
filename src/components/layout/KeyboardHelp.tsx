"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: "Analysis & review",
    keys: [
      [["←", "→"], "Previous / next move"],
      [["Home", "↑"], "Start of the game"],
      [["End", "↓"], "End of the game"],
      [["Space"], "Play / pause autoplay"],
      [["F"], "Flip the board"],
      [["Esc"], "Leave a variation"],
    ],
  },
  {
    title: "Play",
    keys: [
      [["←", "→"], "Look back / forward through the game"],
      [["Home", "End"], "First / current position"],
    ],
  },
  {
    title: "Anywhere",
    keys: [[["?"], "Show this list"]],
  },
];

/** Keyboard shortcuts overview, opened with "?" from any page. */
export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("tempo:shortcuts", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("tempo:shortcuts", onOpen);
    };
  }, []);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts">
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <section key={g.title} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{g.title}</h3>
            <dl className="space-y-1.5">
              {g.keys.map(([keys, what]) => (
                <div key={what} className="flex items-center justify-between gap-4 text-sm">
                  <dt className="flex gap-1">
                    {keys.map((k) => (
                      <kbd key={k} className="min-w-7 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-center font-mono text-xs shadow-sm">
                        {k}
                      </kbd>
                    ))}
                  </dt>
                  <dd className="text-right text-ink-2">{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
