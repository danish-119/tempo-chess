"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Alert, Button, EmptyState, Field, Spinner, inputClass } from "@/components/ui/primitives";
import {
  type LichessGameSummary,
  LichessError,
  type LichessMonth,
  type LichessProfile,
  fetchLichessMonthGames,
  fetchLichessProfile,
  importLichessGame,
  lichessMonths,
  normalizeLichessUsername,
} from "@/lib/lichess/client";
import { PgnParseError } from "@/lib/chess/types";
import { StorageError, saveGame } from "@/lib/storage/db";
import { monthKey, setQuery } from "@/lib/url";

type ColorFilter = "all" | "w" | "b";
type OutcomeFilter = "all" | "win" | "loss" | "draw";
type ClassFilter = "all" | "bullet" | "blitz" | "rapid" | "classical" | "daily";

const OUTCOME_STYLE: Record<string, string> = {
  win: "bg-good-soft text-good",
  loss: "bg-bad-soft text-bad",
  draw: "bg-surface-2 text-ink-2",
};

function errorMessage(err: unknown): string {
  if (err instanceof LichessError || err instanceof PgnParseError || err instanceof StorageError) return err.message;
  return "Something went wrong. Please try again.";
}

export function LichessImport({ initialUser, initialMonth }: { initialUser?: string | null; initialMonth?: string | null }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [profile, setProfile] = useState<LichessProfile | null>(null);
  const [months, setMonths] = useState<LichessMonth[] | null>(null);
  const [month, setMonth] = useState<number>(0);
  const [games, setGames] = useState<LichessGameSummary[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [loading, setLoading] = useState<"profile" | "games" | "open" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<ColorFilter>("all");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [timeClass, setTimeClass] = useState<ClassFilter>("all");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);


  const loadMonth = useCallback(async (user: string, m: LichessMonth) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading("games");
    setError(null);
    try {
      const res = await fetchLichessMonthGames(user, m, controller.signal);
      setGames(res.games);
      setSkipped(res.skipped);
    } catch (err) {
      if (!controller.signal.aborted) {
        setGames(null);
        setError(errorMessage(err));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(null);
    }
  }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(username, null);
  };

  async function runSearch(input: string, preferredMonth: string | null) {
    let name: string;
    try {
      name = normalizeLichessUsername(input);
      setInputError(null);
    } catch (err) {
      setInputError(errorMessage(err));
      return;
    }
    setLoading("profile");
    setError(null);
    setProfile(null);
    setMonths(null);
    setGames(null);
    try {
      const p = await fetchLichessProfile(name);
      const ms = lichessMonths(p.createdAt);
      setProfile(p);
      setMonths(ms);
      const idx = Math.max(0, preferredMonth ? ms.findIndex((m) => monthKey(m.year, m.month) === preferredMonth) : 0);
      setMonth(idx);
      setLoading(null);
      if (ms.length > 0) {
        setQuery({ tab: "lichess", user: p.username, month: monthKey(ms[idx].year, ms[idx].month) });
        await loadMonth(name, ms[idx]);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading((l) => (l === "profile" ? null : l));
    }
  }

  // Coming back (Back button / reload): restore the same search.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !initialUser) return;
    restored.current = true;
    setUsername(initialUser);
    void runSearch(initialUser, initialMonth ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const filtered = useMemo(
    () =>
      (games ?? []).filter(
        (g) => (color === "all" || g.userColor === color) && (outcome === "all" || g.outcome === outcome) && (timeClass === "all" || g.timeClass === timeClass),
      ),
    [games, color, outcome, timeClass],
  );

  const open = async (summary: LichessGameSummary) => {
    setLoading("open");
    setError(null);
    try {
      const game = importLichessGame(summary);
      await saveGame(game, { perspective: summary.userColor ?? undefined });
      router.push(`/analyze?game=${encodeURIComponent(game.id)}`);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <div className="flex-1">
          <Field label="Lichess username" error={inputError}>
            {(p) => (
              <input
                {...p}
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. thibault or a profile URL"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={80}
              />
            )}
          </Field>
        </div>
        <Button type="submit" variant="primary" loading={loading === "profile"}>
          <Search className="size-4" aria-hidden /> Find games
        </Button>
      </form>

      {error ? <Alert tone="error" title="Couldn't load games">{error}</Alert> : null}

      {profile && months ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="font-semibold">{profile.username}</span>
              {profile.title ? <span className="ml-1 rounded bg-accent-soft px-1 text-xs font-bold text-accent">{profile.title}</span> : null}
            </p>
            <a href={`https://lichess.org/@/${profile.username}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-3 underline">
              Lichess profile <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Month
              <select
                className={inputClass}
                value={month}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setMonth(i);
                  setQuery({ month: monthKey(months[i].year, months[i].month) });
                  void loadMonth(profile.username, months[i]);
                }}
              >
                {months.map((m, i) => (
                  <option key={m.since} value={i}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Time control
              <select className={inputClass} value={timeClass} onChange={(e) => setTimeClass(e.target.value as ClassFilter)}>
                <option value="all">All</option>
                <option value="bullet">Bullet</option>
                <option value="blitz">Blitz</option>
                <option value="rapid">Rapid</option>
                <option value="classical">Classical</option>
                <option value="daily">Correspondence</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Result
              <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value as OutcomeFilter)}>
                <option value="all">All</option>
                <option value="win">Wins</option>
                <option value="loss">Losses</option>
                <option value="draw">Draws</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Played as
              <select className={inputClass} value={color} onChange={(e) => setColor(e.target.value as ColorFilter)}>
                <option value="all">Either</option>
                <option value="w">White</option>
                <option value="b">Black</option>
              </select>
            </label>
          </div>

          {loading === "games" ? (
            <Spinner label="Loading games from Lichess…" />
          ) : games ? (
            <>
              <p className="text-xs text-ink-3" aria-live="polite">
                Showing {filtered.length} of {games.length} games
                {skipped > 0 ? ` · ${skipped} variant game${skipped === 1 ? "" : "s"} skipped` : ""}
              </p>
              {filtered.length === 0 ? (
                <EmptyState title="No games match these filters" />
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {filtered.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => void open(g)}
                        disabled={loading === "open"}
                        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left hover:bg-surface-2 disabled:opacity-60"
                      >
                        <span className={`w-12 rounded px-1.5 py-0.5 text-center text-xs font-semibold capitalize ${OUTCOME_STYLE[g.outcome ?? "draw"]}`}>{g.outcome ?? "–"}</span>
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-medium">{g.white.username}</span>
                          <span className="text-ink-3"> ({g.white.rating ?? "?"})</span>
                          <span className="text-ink-3"> vs </span>
                          <span className="font-medium">{g.black.username}</span>
                          <span className="text-ink-3"> ({g.black.rating ?? "?"})</span>
                          {g.openingName ? <span className="block truncate text-xs text-ink-3">{g.openingName}</span> : null}
                        </span>
                        <span className="text-xs capitalize text-ink-3">
                          {g.timeClass === "daily" ? "correspondence" : g.timeClass}
                          {g.rated === false ? " · casual" : ""}
                        </span>
                        <span className="text-xs text-ink-3 tabular">{new Date(g.endTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
