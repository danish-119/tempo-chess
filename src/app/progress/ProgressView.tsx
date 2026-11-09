"use client";

import { useAccount } from "@/components/providers/AccountProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Brain, CalendarCheck, Crown, Flame, TrendingUp } from "lucide-react";
import { Alert, Card, SectionTitle, cx } from "@/components/ui/primitives";
import { ProgressSkeleton } from "@/components/ui/Skeleton";
import { useProgress } from "@/hooks/useProgress";
import {
  addDays,
  currentStreak,
  dailyPuzzleIndex,
  dateKey,
  longestStreak,
  totals,
} from "@/lib/progress";
import { loadPuzzles } from "@/lib/puzzles";

const WEEKS = 16;

function Stat({ icon, label, short, value, hint }: { icon: React.ReactNode; label: string; short?: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-2.5 sm:p-4">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3 sm:gap-1.5 sm:text-xs">
        <span className="max-sm:hidden">{icon}</span>
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="max-sm:hidden">{label}</span>
          </>
        ) : (
          label
        )}
      </p>
      <p className="mt-0.5 font-serif text-xl font-semibold tabular sm:mt-1 sm:text-3xl">{value}</p>
      {hint ? <p className="text-xs text-ink-3 max-sm:hidden">{hint}</p> : null}
    </Card>
  );
}

/** Streak, rating estimate, daily puzzle and endgames mastered, from the player's account or guest session. */
export function ProgressView() {
  const account = useAccount();
  const router = useRouter();
  // Progress is for players (an account or a guest). A visitor has nothing saved, so the page is not theirs to see.
  useEffect(() => {
    if (account.status === "visitor") router.replace("/");
  }, [account.status, router]);
  const { progress, ready } = useProgress();
  const [today, setToday] = useState<string>("");
  const [dailyId, setDailyId] = useState<string | null>(null);

  useEffect(() => {
    const t = dateKey();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(t);
    loadPuzzles()
      .then((all) => setDailyId(all[dailyPuzzleIndex(t, all.length)]?.id ?? null))
      .catch(() => setDailyId(null));
  }, []);

  const stats = useMemo(() => (today ? { streak: currentStreak(progress, today), longest: longestStreak(progress), ...totals(progress) } : null), [progress, today]);

  // Calendar: WEEKS columns of 7 days, ending with this week (Monday first).
  const cells = useMemo(() => {
    if (!today) return [];
    const d = new Date(`${today}T00:00:00`);
    const mondayOffset = (d.getDay() + 6) % 7; // 0 = Monday
    const lastMonday = addDays(today, -mondayOffset);
    const first = addDays(lastMonday, -(WEEKS - 1) * 7);
    const out: { key: string; count: number; future: boolean }[] = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const key = addDays(first, i);
      const day = progress.days[key];
      out.push({ key, count: day ? day.solved + day.attempted + day.other : 0, future: key > today });
    }
    return out;
  }, [progress, today]);

  const daily = today ? progress.daily[today] : undefined;

  if (!ready || !stats || account.status !== "user") return <ProgressSkeleton />;
  const empty = stats.activeDays === 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader eyebrow="You" title="Progress" phone={false} />

      {account.player.guest ? (
        <Alert tone="info" title="Keep your progress for good" className="max-sm:hidden">
          As a guest, your progress is saved on this browser while you come back at least once a month.{" "}
          <Link href="/account" className="font-semibold underline">Sign in with Google</Link> to keep it for good, on every device.
        </Alert>
      ) : empty ? (
        <Alert tone="info" title="Your journey starts today" className="max-sm:hidden" />
      ) : null}

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <Stat icon={<Flame className="size-3.5 text-accent" aria-hidden />} label="Streak" value={`${stats.streak} ${stats.streak === 1 ? "day" : "days"}`} hint={`Longest: ${stats.longest}`} />
        <Stat icon={<TrendingUp className="size-3.5" aria-hidden />} label="Puzzle rating" short="Rating" value={progress.rating.games === 0 ? "—" : `≈${progress.rating.value}`} hint={progress.rating.games < 10 ? "Solve 10 puzzles for a steadier estimate" : `From ${progress.rating.games} puzzles`} />
        <Stat icon={<CalendarCheck className="size-3.5" aria-hidden />} label="Solved first try" short="Solved" value={stats.solved} hint={`of ${stats.attempted} attempted`} />
        <Stat icon={<Brain className="size-3.5" aria-hidden />} label="Active days" short="Days" value={stats.activeDays} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {dailyId ? (
          <Link
            href={`/practice?mode=puzzles&id=${dailyId}&daily=1`}
            className="group flex flex-col gap-1 rounded-2xl border border-border bg-surface p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-[var(--shadow)] active:scale-[0.985] sm:p-5"
          >
            <CalendarCheck className="size-5 text-accent" aria-hidden />
            <span className="display mt-1 text-lg sm:text-2xl">Today&apos;s puzzle</span>
            <span className="text-xs text-ink-3">{daily?.solved ? "Solved" : "Not solved yet"}</span>
          </Link>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-3.5" aria-hidden />
        )}
        <Link
          href="/practice?mode=endgames"
          className="group flex flex-col gap-1 rounded-2xl border border-border bg-surface p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-[var(--shadow)] active:scale-[0.985] sm:p-5"
        >
          <Crown className="size-5 text-accent" aria-hidden />
          <span className="display mt-1 text-lg sm:text-2xl">Endgames</span>
          <span className="text-xs text-ink-3">{progress.lessons.filter((l) => l.startsWith("endgame:")).length} mastered</span>
        </Link>
      </div>

      <Card className="p-3 sm:p-4">
        <SectionTitle className="mb-2 sm:mb-3">Last {WEEKS} weeks</SectionTitle>
        <div className="relative overflow-x-auto">
          <ol
            className="mx-auto grid w-max grid-flow-col grid-rows-7 gap-1"
            aria-label={`Activity calendar for the last ${WEEKS} weeks. ${stats.activeDays} active days in total.`}
          >
            {cells.map((c) => (
              <li
                key={c.key}
                title={`${c.key}: ${c.count} ${c.count === 1 ? "activity" : "activities"}`}
                className={cx(
                  "size-3 rounded-sm border border-border/60 sm:size-4",
                  c.future && "opacity-0",
                  !c.future && c.count === 0 && "bg-surface-2",
                  c.count >= 1 && c.count < 3 && "bg-accent/35",
                  c.count >= 3 && c.count < 8 && "bg-accent/65",
                  c.count >= 8 && "bg-accent",
                )}
              >
                <span className="sr-only">
                  {c.key}: {c.count}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Card>

    </div>
  );
}
