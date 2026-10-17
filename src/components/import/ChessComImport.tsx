"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Alert, Button, EmptyState, Field, Spinner, inputClass } from "@/components/ui/primitives";
import {
  type ArchiveMonth,
  type ChessComGameSummary,
  ChessComError,
  type ChessComProfile,
  fetchArchives,
  fetchMonthGames,
  fetchProfile,
  importChessComGame,
  normalizeUsername,
} from "@/lib/chesscom/client";
import { PgnParseError } from "@/lib/chess/types";
import { StorageError, saveGame } from "@/lib/storage/db";
import { monthKey, setQuery } from "@/lib/url";

type ColorFilter = "all" | "w" | "b";
type OutcomeFilter = "all" | "win" | "loss" | "draw";
type ClassFilter = "all" | "bullet" | "blitz" | "rapid" | "classical" | "daily";

function errorMessage(err: unknown): string {
  if (err instanceof ChessComError || err instanceof PgnParseError || err instanceof StorageError) return err.message;
  return "Something went wrong. Please try again.";
}

const OUTCOME_STYLE: Record<string, string> = {
  win: "bg-good-soft text-good",
  loss: "bg-bad-soft text-bad",
  draw: "bg-surface-2 text-ink-2",
};

export function ChessComImport({ initialUser, initialMonth }: { initialUser?: string | null; initialMonth?: string | null }) {
  const router = useRouter();
  const { settings, ready, update } = useSettings();
  const [username, setUsername] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ChessComProfile | null>(null);
  const [months, setMonths] = useState<ArchiveMonth[] | null>(null);
  const [month, setMonth] = useState<string>("");
  const [games, setGames] = useState<ChessComGameSummary[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [loading, setLoading] = useState<"profile" | "games" | "open" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [color, setColor] = useState<ColorFilter>("all");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [timeClass, setTimeClass] = useState<ClassFilter>("all");
  const abortRef = useRef<AbortController | null>(null);
  const prefilled = useRef(false);


  useEffect(() => () => abortRef.current?.abort(), []);

  /** Load one month; returns true on success. */
  const loadMonth = useCallback(async (user: string, m: ArchiveMonth, quiet = false): Promise<boolean> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading("games");
    setError(null);
    setNotice(null);
    try {
      const res = await fetchMonthGames(user, m, controller.signal);
      setGames(res.games);
      setSkipped(res.skipped);
      return true;
    } catch (err) {
      if (!controller.signal.aborted) {
        setGames(null);
        if (!quiet) setError(errorMessage(err));
      }
      return false;
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
      name = normalizeUsername(input);
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
      const p = await fetchProfile(name);
      const archives = await fetchArchives(name);
      setProfile(p);
      setMonths(archives);
      update({ chessComUsername: p.username });
      if (archives.length > 0) {
        setLoading(null);
        // Restore the month from the address if there is one; otherwise the
        // newest, falling back to earlier months if Chess.com fails on it.
        const preferred = preferredMonth ? archives.find((a) => monthKey(a.year, a.month) === preferredMonth) : undefined;
        const tries = preferred ? [preferred] : archives.slice(0, 3);
        for (let i = 0; i < tries.length; i++) {
          setMonth(tries[i].url);
          const last = i === tries.length - 1;
          if (await loadMonth(name, tries[i], !last)) {
            setQuery({ tab: "chesscom", user: p.username, month: monthKey(tries[i].year, tries[i].month) });
            if (i > 0) setNotice(`Chess.com couldn't return ${archives[0].label}; showing ${tries[i].label}.`);
            break;
          }
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading((l) => (l === "profile" ? null : l));
    }
  }

  useEffect(() => {
    if (!ready || prefilled.current) return;
    prefilled.current = true;
    if (initialUser) {
      // Coming back (Back button / reload): restore the same search.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername(initialUser);
      void runSearch(initialUser, initialMonth ?? null);
    } else if (settings.chessComUsername) {
      setUsername(settings.chessComUsername);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);


  const filtered = useMemo(
    () =>
      (games ?? []).filter(
        (g) =>
          (color === "all" || g.userColor === color) &&
          (outcome === "all" || g.outcome === outcome) &&
          (timeClass === "all" || g.timeClass === timeClass),
      ),
    [games, color, outcome, timeClass],
  );

  const open = async (summary: ChessComGameSummary) => {
    setLoading("open");
    setError(null);
    try {
      const game = importChessComGame(summary);
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
          <Field label="Chess.com username" error={inputError}>
            {(p) => (
              <input
                {...p}
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. danish-119 or a profile URL"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={80}
              />
            )}
          </Field>
        </div>
        <Button type="submit" variant="primary" loading={loading === "profile"} className="sm:mb-[22px]">
          <Search className="size-4" aria-hidden /> Find games
        </Button>
      </form>

      {error ? <Alert tone="error" title="Couldn't load games">{error}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {profile && months ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="font-semibold">{profile.username}</span>
              {profile.title ? <span className="ml-1 rounded bg-accent-soft px-1 text-xs font-bold text-accent">{profile.title}</span> : null}
              <span className="text-ink-3"> · {months.length} month{months.length === 1 ? "" : "s"} with games</span>
            </p>
            {profile.url ? (
              <a href={profile.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-3 underline">
                Chess.com profile <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </div>

          {months.length === 0 ? (
            <EmptyState title="No public games yet">This account has no finished public games in its archive.</EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
                  Month
                  <select
                    className={inputClass}
                    value={month}
                    onChange={(e) => {
                      setMonth(e.target.value);
                      const m = months.find((x) => x.url === e.target.value);
                      if (m) {
                        setQuery({ month: monthKey(m.year, m.month) });
                        void loadMonth(profile.username, m);
                      }
                    }}
                  >
                    {months.map((m) => (
                      <option key={m.url} value={m.url}>
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
                    <option value="daily">Daily</option>
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
                <Spinner label="Loading games from Chess.com…" />
              ) : games ? (
                <>
                  <p className="text-xs text-ink-3" aria-live="polite">
                    Showing {filtered.length} of {games.length} games
                    {skipped > 0 ? ` · ${skipped} variant game${skipped === 1 ? "" : "s"} skipped (only standard chess is supported)` : ""}
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
                            <span className={`w-12 rounded px-1.5 py-0.5 text-center text-xs font-semibold capitalize ${OUTCOME_STYLE[g.outcome ?? "draw"]}`}>
                              {g.outcome ?? "–"}
                            </span>
                            <span className="min-w-0 flex-1 text-sm">
                              <span className="font-medium">{g.white.username}</span>
                              <span className="text-ink-3"> ({g.white.rating ?? "?"})</span>
                              <span className="text-ink-3"> vs </span>
                              <span className="font-medium">{g.black.username}</span>
                              <span className="text-ink-3"> ({g.black.rating ?? "?"})</span>
                              {g.openingName ? <span className="block truncate text-xs text-ink-3">{g.openingName}</span> : null}
                            </span>
                            <span className="text-xs capitalize text-ink-3">
                              {g.timeClass}
                              {g.rated === false ? " · unrated" : ""}
                            </span>
                            <span className="text-xs text-ink-3 tabular">
                              {g.endTime ? new Date(g.endTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}

    </div>
  );
}
