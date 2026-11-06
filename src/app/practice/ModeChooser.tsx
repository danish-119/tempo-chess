"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brain, CalendarCheck, ChevronRight, Flame } from "lucide-react";
import { Card, cx } from "@/components/ui/primitives";
import { useProgress } from "@/hooks/useProgress";
import { currentStreak, dailyPuzzleIndex, dateKey, dueMistakes } from "@/lib/progress";
import { loadPuzzles } from "@/lib/puzzles";

export interface ModeInfo<Id extends string> {
  id: Id;
  title: string;
  text: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

export interface ModeGroup<Id extends string> {
  title: string;
  blurb: string;
  ids: readonly Id[];
}

/** Today's snapshot: streak, daily puzzle and mistakes due — the fastest way back into a habit. */
function TodayStrip() {
  const { progress, ready } = useProgress();
  const [today, setToday] = useState("");
  const [dailyId, setDailyId] = useState<string | null>(null);

  useEffect(() => {
    const t = dateKey();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(t);
    loadPuzzles()
      .then((all) => setDailyId(all[dailyPuzzleIndex(t, all.length)]?.id ?? null))
      .catch(() => setDailyId(null));
  }, []);

  if (!ready || !today) return <div className="h-[72px] rounded-xl border border-border bg-surface" aria-hidden />;
  const streak = currentStreak(progress, today);
  const due = dueMistakes(progress, today).length;
  const daily = progress.daily[today];

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <p className="flex items-center gap-2 text-sm">
        <Flame className={cx("size-5", streak > 0 ? "text-accent" : "text-ink-3")} aria-hidden />
        <span>
          <strong className="font-serif text-xl tabular">{streak}</strong> day streak
        </span>
      </p>
      <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
        {dailyId ? (
          <Link
            href={`/practice?mode=puzzles&id=${dailyId}&daily=1`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2"
          >
            <CalendarCheck className="size-4 text-accent" aria-hidden />
            {daily?.solved ? "Daily puzzle · solved" : "Today's puzzle"}
          </Link>
        ) : null}
        {due > 0 ? (
          <Link
            href="/practice?mode=mistakes"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink hover:brightness-110"
          >
            <Brain className="size-4" aria-hidden />
            {due} mistake{due === 1 ? "" : "s"} due
          </Link>
        ) : null}
        <Link href="/progress" className="inline-flex h-9 items-center px-2 text-sm text-ink-2 underline underline-offset-2 hover:text-ink">
          Progress
        </Link>
      </div>
    </Card>
  );
}

/** Practice home: today's snapshot, then modes grouped by what they train. */
export function ModeChooser<Id extends string>({
  modes,
  groups,
  onChoose,
}: {
  modes: readonly ModeInfo<Id>[];
  groups: readonly ModeGroup<Id>[];
  onChoose: (id: Id) => void;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Practice</h1>
      <TodayStrip />
      {groups.map((group) => (
        <section key={group.title} aria-labelledby={`grp-${group.title}`} className="space-y-2">
          <div>
            <h2 id={`grp-${group.title}`} className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              {group.title}
            </h2>
            <p className="text-sm text-ink-2">{group.blurb}</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.ids.map((id) => {
              const m = modes.find((x) => x.id === id);
              if (!m) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onChoose(id)}
                    className="group flex h-full w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent group-hover:bg-surface">
                      <m.Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{m.title}</span>
                      <span className="block text-xs leading-snug text-ink-2">{m.text}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-3 group-hover:text-accent" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
