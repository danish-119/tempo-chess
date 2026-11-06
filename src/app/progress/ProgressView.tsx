"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, CalendarCheck, Download, Flame, Trash2, TrendingUp, Upload } from "lucide-react";
import { Alert, ButtonLink, Button, Card, SectionTitle, cx } from "@/components/ui/primitives";
import { useProgress } from "@/hooks/useProgress";
import {
  addDays,
  currentStreak,
  dailyPuzzleIndex,
  dateKey,
  dueMistakes,
  emptyProgress,
  exportProgress,
  longestStreak,
  mergeProgress,
  parseProgress,
  totals,
} from "@/lib/progress";
import { loadPuzzles } from "@/lib/puzzles";
import { getProgress, setProgress } from "@/lib/storage/db";

const WEEKS = 16;

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
        {icon} {label}
      </p>
      <p className="mt-1 font-serif text-3xl font-semibold tabular">{value}</p>
      {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </Card>
  );
}

/** Streak, rating estimate, daily puzzle, mistake bank and backup — all from this device's IndexedDB. */
export function ProgressView() {
  const { progress, ready } = useProgress();
  const [today, setToday] = useState<string>("");
  const [dailyId, setDailyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = dateKey();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(t);
    loadPuzzles()
      .then((all) => setDailyId(all[dailyPuzzleIndex(t, all.length)]?.id ?? null))
      .catch(() => setDailyId(null));
  }, []);

  const stats = useMemo(() => (today ? { streak: currentStreak(progress, today), longest: longestStreak(progress), ...totals(progress), due: dueMistakes(progress, today).length } : null), [progress, today]);

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

  const doExport = () => {
    const blob = new Blob([exportProgress(progress)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tempo-progress-${dateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: "success", text: "Progress exported. Keep the file somewhere safe." });
  };

  const doImport = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ tone: "error", text: "That file is too large to be a Tempo progress backup." });
      return;
    }
    const result = parseProgress(await file.text());
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    await setProgress(mergeProgress(await getProgress(), result.progress));
    setMessage({ tone: "success", text: "Progress imported and merged with what you already have." });
  };

  if (!ready || !stats) return <p className="py-10 text-center text-sm text-ink-2">Loading your progress…</p>;
  const empty = stats.activeDays === 0;

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Progress</h1>

      {empty ? (
        <Alert tone="info" title="Your journey starts today">
          Solve a puzzle, play a practice mode or review a game and your streak begins. Everything is stored privately on this device.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Flame className="size-3.5 text-accent" aria-hidden />} label="Streak" value={`${stats.streak} ${stats.streak === 1 ? "day" : "days"}`} hint={`Longest: ${stats.longest}`} />
        <Stat
          icon={<TrendingUp className="size-3.5" aria-hidden />}
          label="Puzzle rating"
          value={progress.rating.games === 0 ? "—" : `≈${progress.rating.value}`}
          hint={progress.rating.games < 10 ? "Solve 10 puzzles for a steadier estimate" : `From ${progress.rating.games} puzzles`}
        />
        <Stat icon={<CalendarCheck className="size-3.5" aria-hidden />} label="Solved first try" value={stats.solved} hint={`of ${stats.attempted} attempted`} />
        <Stat icon={<Brain className="size-3.5" aria-hidden />} label="Active days" value={stats.activeDays} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3 p-4">
          <SectionTitle>Today&apos;s puzzle</SectionTitle>
          {daily?.solved ? (
            <Alert tone="success" title="Solved — nice work">
              Come back tomorrow for a new one.
            </Alert>
          ) : (
            <p className="text-sm text-ink-2">
              {daily ? "You missed it earlier; you can try again." : "One puzzle a day, the same for everyone on the same date. It keeps your streak alive."}
            </p>
          )}
          {dailyId ? (
            <ButtonLink href={`/practice?mode=puzzles&id=${dailyId}&daily=1`} variant="primary">
              {daily?.solved ? "Play it again" : "Solve today's puzzle"}
            </ButtonLink>
          ) : null}
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle>Mistake bank</SectionTitle>
          <p className="text-sm text-ink-2">
            {progress.mistakes.length === 0
              ? "Add mistakes from a game review and Tempo brings them back at spaced intervals until you find the right move."
              : `${stats.due} due today · ${progress.mistakes.length} saved in total.`}
          </p>
          <ButtonLink href="/practice?mode=mistakes" variant={stats.due > 0 ? "primary" : "secondary"}>
            {stats.due > 0 ? `Practise ${stats.due} mistake${stats.due === 1 ? "" : "s"}` : "Open mistake bank"}
          </ButtonLink>
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle className="mb-3">Last {WEEKS} weeks</SectionTitle>
        <div className="overflow-x-auto">
          <ol
            className="grid min-w-max grid-flow-col grid-rows-7 gap-1"
            aria-label={`Activity calendar for the last ${WEEKS} weeks. ${stats.activeDays} active days in total.`}
          >
            {cells.map((c) => (
              <li
                key={c.key}
                title={`${c.key}: ${c.count} ${c.count === 1 ? "activity" : "activities"}`}
                className={cx(
                  "size-4 rounded-sm border border-border/60",
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

      <Card className="space-y-3 p-4">
        <SectionTitle>Backup</SectionTitle>
        <p className="text-sm text-ink-2">
          Tempo has no accounts, so your progress lives only in this browser. Export it to keep a copy or move it to another device; importing merges with what you have.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doExport}>
            <Download className="mr-1.5 size-4" aria-hidden /> Export progress
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 size-4" aria-hidden /> Import progress
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Import progress file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void doImport(f);
            }}
          />
          {confirmReset ? (
            <>
              <Button
                variant="danger"
                onClick={async () => {
                  await setProgress(emptyProgress());
                  setConfirmReset(false);
                  setMessage({ tone: "success", text: "Progress reset." });
                }}
              >
                Yes, reset everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmReset(true)}>
              <Trash2 className="mr-1.5 size-4" aria-hidden /> Reset
            </Button>
          )}
        </div>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      </Card>

      <p className="text-center text-xs text-ink-3">
        The rating is an estimate from the puzzles you solve here, not an official rating. <Link href="/practice" className="underline">Back to practice</Link>
      </p>
    </div>
  );
}
