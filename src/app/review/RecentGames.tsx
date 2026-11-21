"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChartLine, ChevronRight } from "lucide-react";
import { useAccount } from "@/components/providers/AccountProvider";
import { cx } from "@/components/ui/primitives";
import { type SavedGame, listGames } from "@/lib/storage/db";

/** The result from the point of view of the side the player played, when we know it. */
function outcome(g: SavedGame): "win" | "loss" | "draw" | null {
  const r = g.game.metadata.result;
  if (r === "1/2-1/2") return "draw";
  if (!g.perspective || (r !== "1-0" && r !== "0-1")) return null;
  return (r === "1-0") === (g.perspective === "w") ? "win" : "loss";
}

type Show = "all" | "reviewed";
const SHOW: { id: Show; label: string }[] = [
  { id: "all", label: "All" },
  { id: "reviewed", label: "Reviewed" },
];
/** How many games the list shows. */
const SHOWN = 12;

/**
 * The player's saved games, newest first (all of them, or only the reviewed ones), each opening straight on the
 * analysis board: everything saved in their account or guest session.
 */
export function RecentGames() {
  const account = useAccount();
  const [all, setAll] = useState<SavedGame[] | null>(null);
  const [show, setShow] = useState<Show>("all");

  useEffect(() => {
    if (account.status === "loading") return;
    let alive = true;
    listGames().then(
      (g) => alive && setAll(g),
      () => alive && setAll([]),
    );
    return () => {
      alive = false;
    };
  }, [account.status]);

  if (!all?.length) return null;
  // Filter the whole list first, so "Reviewed" also finds reviews older than the newest few games.
  const games = (show === "reviewed" ? all.filter((g) => g.hasReview) : all).slice(0, SHOWN);
  return (
    <section aria-labelledby="recent-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="recent-h" className="flex items-center gap-2 font-semibold">
          <ChartLine className="size-4 text-accent" aria-hidden /> Your games
        </h2>
        <div role="radiogroup" aria-label="Show games" className="flex rounded-full border border-border p-0.5">
          {SHOW.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={show === s.id}
              onClick={() => setShow(s.id)}
              className={cx("h-7 rounded-full px-3 text-xs font-medium transition-colors", show === s.id ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {games.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-ink-2">
          No reviewed games yet. Open a game and run a review, and it will be listed here.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {games.map((g) => {
            const m = g.game.metadata;
            const o = outcome(g);
            return (
              <li key={g.id}>
                <Link href={`/analyze?game=${encodeURIComponent(g.id)}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span
                    className={cx(
                      "grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold",
                      o === "win" ? "bg-good/15 text-good" : o === "loss" ? "bg-bad/15 text-bad" : "bg-surface-2 text-ink-2",
                    )}
                    aria-label={o ? `You ${o === "win" ? "won" : o === "loss" ? "lost" : "drew"}` : undefined}
                  >
                    {o === "win" ? "W" : o === "loss" ? "L" : o === "draw" ? "½" : m.result === "*" ? "·" : m.result.replace("1/2", "½")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {m.white} <span className="text-ink-3">vs</span> {m.black}
                    </span>
                    <span className="block truncate text-xs text-ink-3">
                      {[m.date?.replace(/\./g, "-"), m.openingName, `${Math.ceil(g.game.moves.length / 2)} moves`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {g.hasReview ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Reviewed</span> : null}
                  <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
