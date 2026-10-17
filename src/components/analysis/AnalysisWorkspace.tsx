"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Chess, validateFen } from "chess.js";
import {
  ArrowLeft,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  FlipVertical2,
} from "lucide-react";
import { Board, type BoardArrow } from "@/components/board/Board";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Alert, Button, ButtonLink, IconButton, SectionTitle, Spinner, Tabs, inputClass } from "@/components/ui/primitives";
import { copyText, useAnnouncer } from "@/hooks/useAnnouncer";
import { useEngine } from "@/hooks/useEngine";
import { useLiveAnalysis } from "@/hooks/useLiveAnalysis";
import { useReview } from "@/hooks/useReview";
import { useSound } from "@/hooks/useSound";
import { exportPgn, gameFileName } from "@/lib/chess/export";
import { applyUci, parseUci, sideToMove, terminalState } from "@/lib/chess/line";
import {
  createLocalGame,
  currentFen,
  extendLocalGame,
  initNav,
  lastMove,
  navReducer,
} from "@/lib/chess/navigation";
import { parseSingleGame } from "@/lib/chess/pgn";
import { type ImportedGame, START_FEN } from "@/lib/chess/types";
import { computeTimings, parseTimeControl } from "@/lib/review/time";
import { setQuery } from "@/lib/url";
import { SHARE_MAX_CHARS, decodeShare, shareTokenFromHash, shareUrl } from "@/lib/share";
import { downloadBoardPng } from "@/lib/boardImage";
import { parsePgnDatabase } from "@/lib/chess/pgn";
import { formatScore, winPercentFor } from "@/lib/engine/score";
import { REVIEW_PRESETS } from "@/lib/review/review";
import { type ReviewSettings, isError } from "@/lib/review/types";
import { StorageError, getGame, saveGame } from "@/lib/storage/db";
import { EngineLines } from "./EngineLines";
import { TablebasePanel } from "./TablebasePanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { EvalBar } from "./EvalBar";
import { EvalGraph } from "./EvalGraph";
import { GameInfo } from "./GameInfo";
import { MoveDetail } from "./MoveDetail";
import { MoveList } from "./MoveList";
import { PlayerBar } from "./PlayerBar";
import { CoachCard } from "./CoachCard";
import { ReviewDetails, ReviewScore } from "./ReviewSummary";

type LoadState = { status: "loading" } | { status: "ready"; game: ImportedGame } | { status: "error"; message: string };

/** Route-level component: resolves ?game=<id> or ?fen=<fen> into a game. */
export function AnalysisWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const gameId = params.get("game");
  const fenParam = params.get("fen");
  const plyParam = Number(params.get("ply") ?? "0") || 0;
  const panelParam = params.get("panel");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (gameId) {
      getGame(gameId)
        .then((saved) => {
          if (cancelled) return;
          if (saved) setState({ status: "ready", game: saved.game });
          else setState({ status: "error", message: "That game is not in this browser's saved games. It may have been deleted or saved in another browser." });
        })
        .catch((err: unknown) => {
          if (!cancelled) setState({ status: "error", message: err instanceof StorageError ? err.message : "Could not open the saved game." });
        });
    } else if (shareTokenFromHash(window.location.hash)) {
      // A share link: unpack the game, keep it in this browser, then open it like any import.
      decodeShare(shareTokenFromHash(window.location.hash)!)
        .then(async (pgn) => {
          const game = parsePgnDatabase(pgn).games[0];
          if (!game) throw new Error("empty");
          await saveGame(game);
          if (!cancelled) router.replace(`/analyze?game=${encodeURIComponent(game.id)}`);
        })
        .catch(() => {
          if (!cancelled) setState({ status: "error", message: "This share link is incomplete or damaged. Ask for the link again, or for the PGN." });
        });
    } else {
      const fen = fenParam && validateFen(fenParam).ok ? fenParam : START_FEN;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "ready", game: createLocalGame(fen) });
    }
    return () => {
      cancelled = true;
    };
  }, [gameId, fenParam, router]);

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <Spinner label="Loading game…" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Alert tone="error" title="Game not found" action={<ButtonLink href="/review" variant="primary">Import a game</ButtonLink>}>
          {state.message}
        </Alert>
      </div>
    );
  }
  return <Workspace key={state.game.id} initialGame={state.game} initialPly={plyParam} initialPanel={panelParam} />;
}

/** Retry: any engine line within this many win% of the best counts as correct. */
const ACCEPT_MARGIN = 3;

/** Sentinel value for real-time autoplay. */
const REAL_TIME = -1;

type SideTab = "review" | "moves" | "engine" | "explorer" | "game";
type MoveFilter = "all" | "errors" | "key";

interface RetryState {
  ply: number;
  result: "correct" | "incorrect" | null;
  playedUci?: string;
}

const SIDE_TABS: SideTab[] = ["review", "moves", "engine", "explorer", "game"];

function Workspace({ initialGame, initialPly, initialPanel }: { initialGame: ImportedGame; initialPly: number; initialPanel: string | null }) {
  const router = useRouter();
  const { settings } = useSettings();
  const [game, setGame] = useState(initialGame);
  const [nav, dispatch] = useReducer(navReducer, initNav(initialGame, initialPly));
  const [orientation, setOrientation] = useState<"white" | "black">(() => {
    const me = settings.chessComUsername.toLowerCase();
    return me && initialGame.metadata.black.toLowerCase() === me ? "black" : "white";
  });
  const [liveEnabled, setLiveEnabled] = useState(settings.autoAnalyze);
  const [preset, setPreset] = useState<ReviewSettings["preset"]>(settings.reviewPreset);
  const [tab, setTabState] = useState<SideTab>(
    SIDE_TABS.includes(initialPanel as SideTab) ? (initialPanel as SideTab) : initialGame.source === "local" ? "engine" : "review",
  );
  const setTab = (t: SideTab) => {
    setTabState(t);
    setQuery({ panel: t });
  };
  const [filter, setFilter] = useState<MoveFilter>("all");
  const [retry, setRetry] = useState<RetryState | null>(null);
  // Autoplay: step forward automatically every `autoplayMs`.
  const [autoplay, setAutoplay] = useState(false);
  /** Milliseconds per move, or REAL_TIME to replay with the players' actual thinking time. */
  const [autoplayMs, setAutoplayMs] = useState(1000);
  // Real thinking time per ply (from [%clk] data), if the game has clocks.
  const realTimes = useMemo(() => computeTimings(game.moves, parseTimeControl(game.metadata.timeControl)), [game]);
  const hasRealTime = realTimes.some((t) => t.timeSpentSeconds !== undefined);
  /** Real-time replay: when we started waiting for the move at `ply`, and the latest tick. */
  const [wait, setWait] = useState<{ ply: number; start: number; now: number } | null>(null);
  const [sanInput, setSanInput] = useState("");
  const [sanError, setSanError] = useState<string | null>(null);
  const { message, announce } = useAnnouncer();

  const engine = useEngine();
  const sound = useSound();
  const { state: reviewState, start: startReview, cancel: cancelReview } = useReview(game.source === "local" ? null : game);
  const review = reviewState.status === "done" ? reviewState.review : null;
  const reviewing = reviewState.status === "running";

  const fen = currentFen(nav);
  const engineInstance = engine.status.state === "ready" ? engine.status.engine : null;

  // Lazy-load the engine the first time it is needed.
  useEffect(() => {
    if ((liveEnabled || reviewing || (review && nav.variation)) && engine.status.state === "idle") void engine.load();
  }, [liveEnabled, reviewing, review, nav.variation, engine]);

  // After a review, mainline positions are shown instantly from the stored
  // engine output; live search runs only for variations or "Analyze deeper".
  const [deeper, setDeeper] = useState(false);
  const storedPosition = review && !nav.variation ? review.positions[nav.ply] : null;
  const liveActive = !reviewing && !retry && (review ? !storedPosition || deeper : liveEnabled);
  const live = useLiveAnalysis(engineInstance, retry ? "" : fen, liveActive, {
    depth: settings.liveDepth,
    multiPv: settings.liveMultiPv,
    pauseWhenHidden: settings.pauseWhenHidden,
  });

  const ply = nav.variation ? nav.variation.basePly : nav.ply;

  // Keep the current move in the address so reload / Back return here.
  useEffect(() => {
    if (game.source !== "local") setQuery({ ply: nav.ply || null });
  }, [nav.ply, game.source]);

  const goBack = () => {
    // Return to wherever the user came from (e.g. the game list); fall back to Review.
    if (typeof window !== "undefined" && window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push("/review");
  };

  // Play a move sound when stepping forward by exactly one move.
  const prevPos = useRef({ ply: nav.ply, vIndex: nav.variation?.index ?? -1, vLen: nav.variation?.moves.length ?? 0 });
  useEffect(() => {
    const prev = prevPos.current;
    const v = nav.variation;
    if (v && v.index > 0 && (prev.vIndex === v.index - 1 || (prev.vIndex === -1 && v.index === 1))) {
      sound.playSan(v.moves[v.index - 1].san);
    } else if (!v && nav.ply === prev.ply + 1 && prev.vIndex === -1) {
      const m = game.moves[nav.ply - 1];
      if (m) sound.playSan(m.san);
    }
    prevPos.current = { ply: nav.ply, vIndex: v?.index ?? -1, vLen: v?.moves.length ?? 0 };
  }, [nav, game.moves, sound]);
  const currentMoveReview = !nav.variation && review && nav.ply > 0 ? review.moves[nav.ply - 1] : null;
  const reviewPosition = !nav.variation && review ? review.positions[nav.ply] : null;

  // ---- navigation & moves --------------------------------------------------
  const onBoardMove = useCallback(
    (uci: string): boolean => {
      setAutoplay(false);
      if (retry) {
        const before = review?.positions[retry.ply - 1];
        const mover = sideToMove(game.moves[retry.ply - 1].fenBefore);
        if (!before || before.lines.length === 0) return false;
        const bestWin = winPercentFor(before.lines[0].score, mover);
        const accepted = before.lines
          .filter((l) => bestWin - winPercentFor(l.score, mover) <= ACCEPT_MARGIN)
          .map((l) => l.pv[0])
          .filter((u) => u !== game.moves[retry.ply - 1].uci);
        const ok = accepted.includes(uci);
        setRetry({ ...retry, result: ok ? "correct" : "incorrect", playedUci: uci });
        sound.play(ok ? "correct" : "incorrect");
        announce(ok ? "Correct — that's one of the engine's top moves." : "Not quite. Try again or reveal the answer.");
        return ok;
      }
      if (game.source === "local" && !nav.variation) {
        const next = extendLocalGame(game, nav.ply, uci);
        if (!next) return false;
        setGame(next);
        dispatch({ type: "load", game: next, ply: nav.ply + 1 });
        return true;
      }
      let legal = false;
      try {
        legal = applyUci(new Chess(currentFen(nav)), uci) !== null;
      } catch {
        legal = false;
      }
      if (legal) dispatch({ type: "play", uci });
      return legal;
    },
    [retry, review, game, nav, announce, sound],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === " ") {
        e.preventDefault();
        setAutoplay((a) => !a);
        return;
      }
      const map: Record<string, () => void> = {
        ArrowLeft: () => dispatch({ type: "prev" }),
        ArrowRight: () => dispatch({ type: "next" }),
        Home: () => dispatch({ type: "first" }),
        End: () => dispatch({ type: "last" }),
        ArrowUp: () => dispatch({ type: "first" }),
        ArrowDown: () => dispatch({ type: "last" }),
        f: () => setOrientation((o) => (o === "white" ? "black" : "white")),
        Escape: () => {
          setRetry(null);
          dispatch({ type: "exit-variation" });
        },
      };
      const fn = map[e.key];
      if (fn) {
        e.preventDefault();
        setRetry(null);
        setAutoplay(false);
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const atEnd = nav.variation ? nav.variation.index >= nav.variation.moves.length : nav.ply >= game.moves.length;
  useEffect(() => {
    if (!autoplay || retry) return;
    // Real time: wait as long as the player of the next move actually thought.
    const nextSpent = !nav.variation ? realTimes[nav.ply]?.timeSpentSeconds : undefined;
    const delay = autoplayMs === REAL_TIME ? (nextSpent !== undefined ? Math.max(200, nextSpent * 1000) : 1000) : autoplayMs;
    const start = performance.now();
    const waitingPly = nav.ply;
    // In real-time mode, tick ~10×/s so the mover's clock visibly counts down.
    const ticker = autoplayMs === REAL_TIME ? setInterval(() => setWait({ ply: waitingPly, start, now: performance.now() }), 100) : null;
    const t = setTimeout(() => {
      if (atEnd) setAutoplay(false);
      else dispatch({ type: "next" });
    }, delay);
    return () => {
      clearTimeout(t);
      if (ticker) clearInterval(ticker);
    };
  }, [autoplay, autoplayMs, nav, atEnd, retry, realTimes]);

  const toggleAutoplay = () => {
    setRetry(null);
    if (!autoplay && atEnd) dispatch({ type: nav.variation ? "exit-variation" : "first" });
    setAutoplay((a) => !a);
  };

  const playSan = (e: React.FormEvent) => {
    e.preventDefault();
    const text = sanInput.trim();
    if (!text) return;
    try {
      // Validate SAN against the current position.
      const c = new Chess(retry ? game.moves[retry.ply - 1].fenBefore : fen);
      const m = c.move(text);
      onBoardMove(`${m.from}${m.to}${m.promotion ?? ""}`);
      setSanInput("");
      setSanError(null);
    } catch {
      setSanError(`"${text}" is not a legal move here.`);
    }
  };

  // ---- arrows ---------------------------------------------------------------
  const arrows = useMemo<BoardArrow[]>(() => {
    // Never hint the answer during a retry.
    if (retry) return [];
    const lines = live.snapshot?.lines ?? (reviewPosition?.lines ?? []);
    return lines.slice(0, 2).flatMap((l, i) => {
      const p = l.pv[0] ? parseUci(l.pv[0]) : null;
      return p ? [{ from: p.from, to: p.to, kind: i === 0 ? ("best" as const) : ("alt" as const) }] : [];
    });
  }, [retry, live.snapshot, reviewPosition]);

  // ---- eval bar -------------------------------------------------------------
  const term = terminalState(fen);
  const terminalWinner = term === "checkmate" ? (sideToMove(fen) === "w" ? "b" : "w") : term ? "draw" : null;
  // The bar keeps showing the last known evaluation until the engine reports
  // for the new position, so it glides from move to move instead of
  // snapping back to 50/50.
  const freshScore = live.snapshot?.lines[0]?.score ?? reviewPosition?.score ?? null;
  const [heldScore, setHeldScore] = useState(freshScore);
  if (freshScore && freshScore !== heldScore && (freshScore.kind !== heldScore?.kind || freshScore.value !== heldScore?.value)) {
    setHeldScore(freshScore);
  }
  const barScore = freshScore ?? heldScore;

  // ---- actions ---------------------------------------------------------------
  const persistable = game.source !== "local";
  const handleSave = async () => {
    try {
      let toSave = game;
      if (game.source === "local") {
        if (game.moves.length === 0) {
          announce("Play some moves first.");
          return;
        }
        toSave = parseSingleGame(exportPgn(game), { source: "pgn" });
      }
      await saveGame(toSave);
      announce("Saved to My Games.");
      if (toSave.id !== game.id) router.replace(`/analyze?game=${encodeURIComponent(toSave.id)}`);
    } catch (err) {
      announce(err instanceof StorageError ? err.message : "Could not save the game.");
    }
  };

  const startFullReview = async () => {
    setRetry(null);
    setDeeper(false);
    const eng = engineInstance ?? (await engine.load());
    if (!eng) return;
    void startReview(eng, preset);
  };

  // Analyse once, automatically, when an imported game without a review opens.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !settings.autoReview || game.source === "local" || game.moves.length === 0) return;
    if (reviewState.status !== "idle") return;
    // Deferred so the review starts after this render commits; the flag is
    // set inside the timer so a re-render that cancels it can retry.
    const t = setTimeout(() => {
      if (autoStarted.current) return;
      autoStarted.current = true;
      void startFullReview();
    }, 0);
    return () => clearTimeout(t);
  });

  const moveCopyText = () => {
    const sans = game.moves.slice(0, nav.ply).map((m, i) => (m.color === "w" ? `${m.moveNumber}. ${m.san}` : i === 0 ? `${m.moveNumber}... ${m.san}` : m.san));
    const variation = nav.variation ? nav.variation.moves.slice(0, nav.variation.index).map((m) => m.san) : [];
    return [...sans, ...(variation.length ? [`(${variation.join(" ")})`] : [])].join(" ");
  };

  const visiblePlies = useMemo(() => {
    if (!review || filter === "all") return null;
    const set = new Set<number>();
    for (const m of review.moves) {
      if (filter === "errors" ? isError(m.classification) : m.keyMoment) set.add(m.ply);
    }
    return set;
  }, [review, filter]);

  const boardFen = retry ? game.moves[retry.ply - 1].fenBefore : fen;
  const boardLastMove = retry ? (retry.ply > 1 ? { from: game.moves[retry.ply - 2].from, to: game.moves[retry.ply - 2].to } : null) : lastMove(nav);
  const retryMove = retry ? game.moves[retry.ply - 1] : null;
  const retryReview = retry && review ? review.moves[retry.ply - 1] : null;

  const highlights = useMemo(() => {
    if (!retry || !retry.playedUci || !retry.result) return undefined;
    const p = parseUci(retry.playedUci);
    if (!p) return undefined;
    const kind = retry.result === "correct" ? "good" : "bad";
    return { [p.from]: kind, [p.to]: kind } as Record<string, "good" | "bad">;
  }, [retry]);

  // Live clock for the player about to move during real-time replay: their
  // last recorded clock (or the starting time) minus the time waited so far.
  const liveClock = (() => {
    if (!autoplay || autoplayMs !== REAL_TIME || nav.variation || atEnd || !wait || wait.ply !== nav.ply) return null;
    const next = game.moves[nav.ply];
    if (!next) return null;
    let last: number | undefined;
    for (let i = nav.ply - 1; i >= 0; i--) {
      if (game.moves[i].color === next.color && game.moves[i].clockSeconds !== undefined) {
        last = game.moves[i].clockSeconds;
        break;
      }
    }
    last ??= parseTimeControl(game.metadata.timeControl)?.baseSeconds;
    if (last === undefined) return null;
    const elapsed = Math.max(0, (wait.now - wait.start) / 1000);
    return { color: next.color, seconds: Math.max(0, last - elapsed) };
  })();

  const topColor = orientation === "white" ? "b" : "w";
  const bottomColor = orientation === "white" ? "w" : "b";
  const toMove = sideToMove(boardFen);
  const badge =
    !retry && currentMoveReview && settings.showBoardBadges
      ? { square: game.moves[currentMoveReview.ply - 1].to, classification: currentMoveReview.classification }
      : null;
  const liveScore = live.snapshot?.lines[0]?.score ?? null;

  const goto = (p: number) => {
    setRetry(null);
    dispatch({ type: "goto", ply: p });
  };

  const tabs: { id: SideTab; label: React.ReactNode }[] = [
    { id: "review", label: "Review" },
    { id: "moves", label: "Moves" },
    {
      id: "engine",
      label: (
        <span className="inline-flex items-center gap-1.5">
          Engine
          {liveEnabled && liveScore ? <span className="font-mono text-[11px] text-ink-3 tabular">{formatScore(liveScore)}</span> : null}
        </span>
      ),
    },
    { id: "explorer", label: "Explorer" },
    { id: "game", label: "Game" },
  ];

  return (
    <div className="mx-auto grid max-w-[1600px] gap-3 px-3 py-3 lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:overflow-hidden">
      <h1 className="sr-only">Analysis board</h1>

      {/* Board column: sized so board + player bars + toolbar fit the viewport height. */}
      <section aria-label="Board" className="flex min-h-0 min-w-0 flex-col items-center lg:justify-center">
        <div className="w-full min-w-[260px] max-w-[min(100%,calc(100dvh-3.5rem-9rem))]">
          <PlayerBar color={topColor} metadata={game.metadata} moves={game.moves} ply={ply} toMove={toMove === topColor} liveClock={liveClock?.color === topColor ? liveClock.seconds : undefined} />
          <div className="flex gap-2">
            <EvalBar score={barScore} orientation={orientation} terminal={terminalWinner} />
            <div className="min-w-0 flex-1">
              <Board
                fen={boardFen}
                orientation={orientation}
                lastMove={boardLastMove}
                arrows={arrows}
                highlights={highlights}
                badge={badge}
                interactive={!reviewing && (!retry || retry.result !== "correct")}
                onMove={onBoardMove}
                ariaLabel={retry ? "Retry board: find a better move" : "Analysis board"}
              />
            </div>
          </div>
          <PlayerBar color={bottomColor} metadata={game.metadata} moves={game.moves} ply={ply} toMove={toMove === bottomColor} liveClock={liveClock?.color === bottomColor ? liveClock.seconds : undefined} />

          <div className="no-print flex flex-wrap items-center justify-between gap-1">
            <div className="flex items-center" role="group" aria-label="Move navigation">
              <IconButton label="First move (Home)" onClick={() => { setRetry(null); setAutoplay(false); dispatch({ type: "first" }); }}>
                <ChevronFirst className="size-5" aria-hidden />
              </IconButton>
              <IconButton label="Previous move (←)" onClick={() => { setRetry(null); setAutoplay(false); dispatch({ type: "prev" }); }}>
                <ChevronLeft className="size-5" aria-hidden />
              </IconButton>
              <IconButton label="Next move (→)" onClick={() => { setRetry(null); setAutoplay(false); dispatch({ type: "next" }); }}>
                <ChevronRight className="size-5" aria-hidden />
              </IconButton>
              <IconButton label="Last move (End)" onClick={() => { setRetry(null); setAutoplay(false); dispatch({ type: "last" }); }}>
                <ChevronLast className="size-5" aria-hidden />
              </IconButton>
              <IconButton
                label={autoplay ? "Pause (Space)" : "Play through the game (Space)"}
                onClick={toggleAutoplay}
                disabled={game.moves.length === 0 || !!retry}
                aria-pressed={autoplay}
                className={autoplay ? "bg-accent-soft text-accent" : undefined}
              >
                {autoplay ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
              </IconButton>
              <select
                value={autoplayMs}
                onChange={(e) => setAutoplayMs(Number(e.target.value))}
                aria-label="Autoplay speed"
                className="h-8 rounded-md border border-border bg-surface px-1 text-xs text-ink-2"
              >
                <option value={500}>0.5s</option>
                <option value={1000}>1s</option>
                <option value={2000}>2s</option>
                <option value={3000}>3s</option>
                {hasRealTime ? <option value={REAL_TIME}>Real time</option> : null}
              </select>
              <IconButton label="Flip board (F)" onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>
                <FlipVertical2 className="size-5" aria-hidden />
              </IconButton>
            </div>
            <p className="text-xs text-ink-3 tabular" aria-live="polite">
              {nav.variation ? "Variation · " : ""}
              {ply === 0 && !nav.variation ? "Start" : `Move ${game.moves[ply - 1]?.moveNumber ?? ""}`} · {toMove === "w" ? "White" : "Black"} to move
              {term === "checkmate" ? " · checkmate" : term === "stalemate" ? " · stalemate" : ""}
            </p>
          </div>
          <p className="sr-only" role="status" aria-live="polite">{message ?? ""}</p>
          {message ? <p className="no-print text-center text-xs text-ink-2" aria-hidden>{message}</p> : null}
        </div>
      </section>

      {/* Side panel: tabs; only the tab body scrolls. */}
      <aside aria-label="Analysis panels" className="card flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="no-print flex items-center gap-1 border-b border-border p-2">
          <IconButton label="Back" onClick={goBack} className="shrink-0">
            <ArrowLeft className="size-5" aria-hidden />
          </IconButton>
          <Tabs<SideTab> label="Panels" value={tab} onChange={setTab} tabs={tabs} className="flex min-w-0 flex-1 [&>button]:flex-1" />
        </div>

        {retry && retryMove ? (
          <div className="border-b border-border bg-accent-soft/40 p-3">
            <p className="text-sm font-medium">
              Find a better move than <span className="font-mono">{retryMove.san}</span>
            </p>
            {retry.result === "correct" ? (
              <Alert tone="success" className="mt-2" title="Correct!">
                {retryReview?.bestLineSan.length ? <>Engine line: <span className="font-mono">{retryReview.bestLineSan.slice(0, 6).join(" ")}</span></> : null}
              </Alert>
            ) : retry.result === "incorrect" ? (
              <Alert tone="warning" className="mt-2" title="Not quite — try again" />
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setRetry({ ply: retry.ply, result: null })}>Try again</Button>
              <Button
                size="sm"
                onClick={() => {
                  const line = review?.positions[retry.ply - 1]?.lines[0]?.pv;
                  if (line?.length) {
                    setRetry(null);
                    dispatch({ type: "line", basePly: retry.ply - 1, ucis: line, index: 1 });
                  }
                }}
              >
                Show answer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRetry(null)}>Close</Button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" role="tabpanel" aria-label={`${tab} panel`}>
          {tab === "review" ? (
            game.source === "local" ? (
              <ButtonLink href="/review" variant="primary" className="w-full">Import a game to review</ButtonLink>
            ) : reviewState.status === "loading-saved" ? (
              <Spinner label="Checking for a saved review…" />
            ) : reviewState.status === "running" ? (
              <div className="space-y-2">
                <p className="text-sm tabular" aria-live="polite">
                  Reviewing… {reviewState.progress.done}/{reviewState.progress.total}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={reviewState.progress.total} aria-valuenow={reviewState.progress.done} aria-label="Review progress">
                  <div className="h-full bg-accent transition-[width]" style={{ width: `${(reviewState.progress.done / reviewState.progress.total) * 100}%` }} />
                </div>
                <Button size="sm" onClick={cancelReview}>Cancel</Button>
              </div>
            ) : review ? (
              <div className="space-y-4">
                {reviewState.status === "done" && !reviewState.savedLocally ? (
                  <Alert tone="warning">The review could not be saved in this browser; it will be lost on reload.</Alert>
                ) : null}
                <CoachCard
                  move={currentMoveReview}
                  onShowBest={() => {
                    if (!currentMoveReview) return;
                    const line = review.positions[currentMoveReview.ply - 1]?.lines[0]?.pv;
                    if (line?.length) dispatch({ type: "line", basePly: currentMoveReview.ply - 1, ucis: line, index: 1 });
                  }}
                  onRetry={() => {
                    if (!currentMoveReview) return;
                    setLiveEnabled(false);
                    setRetry({ ply: currentMoveReview.ply, result: null });
                  }}
                  hasPrevKey={review.keyMomentPlies.some((p) => p < ply)}
                  hasNextKey={review.keyMomentPlies.some((p) => p > ply)}
                  onPrevKey={() => {
                    const prev = [...review.keyMomentPlies].reverse().find((p) => p < ply);
                    if (prev !== undefined) goto(prev);
                  }}
                  onNextKey={() => {
                    const next = review.keyMomentPlies.find((p) => p > ply);
                    if (next !== undefined) goto(next);
                  }}
                />
                <EvalGraph review={review} currentPly={ply} onSelect={goto} />
                <ReviewScore review={review} metadata={game.metadata} />
                <details className="no-print rounded-lg border border-border px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">More stats</summary>
                  <ReviewDetails review={review} onJump={goto} />
                </details>
                <details className="no-print">
                  <summary className="cursor-pointer text-xs text-ink-3">Re-run with different settings</summary>
                  <ReviewControls preset={preset} setPreset={setPreset} onStart={startFullReview} disabled={engine.status.state === "loading"} label="Re-run review" />
                </details>
              </div>
            ) : (
              <div className="space-y-3">
                {reviewState.status === "cancelled" ? <Alert tone="info">Review cancelled.</Alert> : null}
                {reviewState.status === "error" ? <Alert tone="error" title="Review failed">{reviewState.message}</Alert> : null}
                <ReviewControls preset={preset} setPreset={setPreset} onStart={startFullReview} disabled={engine.status.state === "loading" || game.moves.length === 0} label="Start full review" />
                {engine.status.state === "error" ? (
                  <Alert tone="error" title="Engine unavailable" action={<Button size="sm" onClick={() => void engine.retry()}>Retry</Button>}>
                    {engine.status.message}
                  </Alert>
                ) : null}
              </div>
            )
          ) : null}

          {tab === "moves" ? (
            <div className="space-y-3">
              {currentMoveReview ? (
                <div className="rounded-lg border border-border p-3">
                  <MoveDetail
                    move={currentMoveReview}
                    onShowBest={() => {
                      const line = review?.positions[currentMoveReview.ply - 1]?.lines[0]?.pv;
                      if (line?.length) dispatch({ type: "line", basePly: currentMoveReview.ply - 1, ucis: line, index: 1 });
                    }}
                    onRetry={() => {
                      setLiveEnabled(false);
                      setRetry({ ply: currentMoveReview.ply, result: null });
                    }}
                  />
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <SectionTitle>Moves</SectionTitle>
                {review ? (
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as MoveFilter)}
                    className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-ink"
                    aria-label="Filter moves"
                  >
                    <option value="all">All moves</option>
                    <option value="errors">Mistakes only</option>
                    <option value="key">Key moments</option>
                  </select>
                ) : null}
              </div>
              <MoveList
                moves={game.moves}
                reviews={review?.moves}
                currentPly={nav.ply}
                variation={nav.variation}
                onSelect={goto}
                onSelectVariation={(i) => dispatch({ type: "variation-goto", index: i })}
                onExitVariation={() => dispatch({ type: "exit-variation" })}
                visiblePlies={visiblePlies}
                scroll={false}
              />
              <form onSubmit={playSan} className="no-print flex gap-2">
                <label htmlFor="san-input" className="sr-only">Type a move in algebraic notation</label>
                <input
                  id="san-input"
                  className={`${inputClass} font-mono`}
                  placeholder="Type a move, e.g. Nf3"
                  value={sanInput}
                  onChange={(e) => setSanInput(e.target.value)}
                  aria-invalid={sanError ? true : undefined}
                  aria-describedby={sanError ? "san-error" : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={reviewing}
                />
                <Button type="submit" disabled={reviewing}>Play</Button>
              </form>
              {sanError ? <p id="san-error" className="text-xs text-bad">{sanError}</p> : null}
            </div>
          ) : null}

          {tab === "engine" ? (
            <EngineLines
              fen={fen}
              status={engine.status}
              snapshot={live.snapshot ?? (storedPosition && !deeper ? { fen: storedPosition.fen, lines: storedPosition.lines, depth: storedPosition.depth, bestmove: storedPosition.bestmove, done: true, stopped: false } : null)}
              running={live.running}
              paused={live.paused}
              enabled={review ? liveActive || !!storedPosition : liveEnabled}
              fromReview={!!storedPosition && !deeper}
              onDeeper={storedPosition ? () => setDeeper((d) => !d) : undefined}
              deeper={deeper}
              busyReason={reviewing ? "Paused during review." : retry ? "Hidden during retry." : null}
              targetDepth={settings.liveDepth}
              onToggle={() => (review ? setDeeper((d) => !d) : setLiveEnabled((v) => !v))}
              onRetry={() => void engine.retry()}
              onExplore={(ucis, idx) => {
                const v = nav.variation;
                if (v) {
                  // Exploring from inside a variation: rebuild from the variation's base.
                  const prefix = v.moves.slice(0, v.index).map((m) => m.uci);
                  dispatch({ type: "line", basePly: v.basePly, ucis: [...prefix, ...ucis], index: v.index + idx });
                } else {
                  dispatch({ type: "line", basePly: nav.ply, ucis, index: idx });
                }
              }}
            />
          ) : null}

          {tab === "engine" && !retry && !reviewing ? <TablebasePanel fen={fen} onPlay={(uci) => void onBoardMove(uci)} /> : null}

          {tab === "explorer" ? <ExplorerPanel fen={fen} onPlay={(uci) => void onBoardMove(uci)} /> : null}

          {tab === "game" ? (
            <GameInfo
              game={game}
              review={review}
              fen={fen}
              persistable={persistable}
              canCopyMoves={nav.ply > 0 || !!nav.variation}
              onCopy={async (what) => {
                const text = what === "fen" ? fen : what === "moves" ? moveCopyText() : game.source === "local" ? exportPgn(game) : game.originalPgn;
                announce((await copyText(text)) ? `${what === "fen" ? "FEN" : what === "moves" ? "Moves" : "PGN"} copied.` : "Copy failed.");
              }}
              onSave={handleSave}
              onShare={async () => {
                const pgn = game.source === "local" ? exportPgn(game) : game.originalPgn;
                const url = await shareUrl(pgn);
                if (url.length > SHARE_MAX_CHARS) {
                  announce("This game is too long for a link. Download the PGN instead.");
                  return;
                }
                announce((await copyText(url)) ? "Share link copied." : "Copy failed.");
              }}
              onImage={() =>
                void downloadBoardPng(`${gameFileName(game).replace(/\.pgn$/, "")}_position.png`, {
                  fen,
                  orientation,
                  boardThemeId: settings.boardTheme,
                  pieceSet: settings.pieceSet,
                  lastMove: boardLastMove,
                }).catch(() => announce("Image export failed."))
              }
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function ReviewControls({
  preset,
  setPreset,
  onStart,
  disabled,
  label,
}: {
  preset: ReviewSettings["preset"];
  setPreset: (p: ReviewSettings["preset"]) => void;
  onStart: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="space-y-2 pt-2">
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-ink-2">Analysis strength</legend>
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(REVIEW_PRESETS) as ReviewSettings["preset"][]).map((p) => (
            <label
              key={p}
              className={`flex cursor-pointer flex-col items-center rounded-md border px-2 py-1.5 text-xs ${preset === p ? "border-accent bg-accent-soft text-ink" : "border-border text-ink-2"}`}
            >
              <input type="radio" name="preset" value={p} checked={preset === p} onChange={() => setPreset(p)} className="sr-only" />
              <span className="font-medium capitalize">{p}</span>
              <span className="text-[10px] text-ink-3">depth {REVIEW_PRESETS[p].depth}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {preset === "deep" ? <p className="text-[11px] text-ink-3">Deep uses more CPU and battery.</p> : null}
      <Button variant="primary" className="w-full" onClick={onStart} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}
