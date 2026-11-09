"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarCheck, Flame } from "lucide-react";
import { Card, cx } from "@/components/ui/primitives";
import { ModeTile } from "./ModeTile";
import { useProgress } from "@/hooks/useProgress";
import { currentStreak, dailyPuzzleIndex, dateKey } from "@/lib/progress";
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

/** Today's snapshot: streak and the daily puzzle, the fastest way back into a habit. */
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
  const daily = progress.daily[today];

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 sm:gap-y-3 sm:p-4">
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
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
      <PageHeader eyebrow="Train" title="Practice" phone={false} />
      <TodayStrip />
      {/* on a phone every mode sits in one grid so the whole page fits the screen */}
      <div className="max-sm:grid max-sm:grid-cols-2 max-sm:gap-2.5 sm:space-y-6">
        {groups.map((group) => (
          <section key={group.title} aria-labelledby={`grp-${group.title}`} className="space-y-2 max-sm:contents">
            <h2 id={`grp-${group.title}`} className="text-xs font-semibold uppercase tracking-wider text-ink-3 max-sm:hidden">
              {group.title}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-sm:contents">
              {group.ids.map((id) => {
                const m = modes.find((x) => x.id === id);
                if (!m) return null;
                return (
                  <li key={id}>
                    <ModeTile id={id} title={m.title} Icon={m.Icon} onChoose={() => onChoose(id)} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
