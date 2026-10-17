"use client";

import Link from "next/link";
import { setQuery } from "@/lib/url";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, validateFen } from "chess.js";
import {
  Check,
  Columns2,
  Flame,
  Hourglass,
  Infinity,
  Lock,
  RefreshCw,
  Timer,
  Zap,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Flag,
  FlipVertical2,
  GraduationCap,
  Handshake,
  Lightbulb,
  RotateCcw,
  Search,
  Swords,
  Undo2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { defaultPieces } from "react-chessboard";
import { Board, type BoardArrow } from "@/components/board/Board";
import { useSettings } from "@/components/providers/SettingsProvider";
import { pieceUrl } from "@/lib/appearance";
import { EvalBar } from "@/components/analysis/EvalBar";
import { MoveClassIcon, moveClassColor } from "@/components/analysis/MoveClassBadge";
import { Alert, Button, Card, IconButton, SectionTitle, Spinner, Toggle, cx } from "@/components/ui/primitives";
import { copyText } from "@/hooks/useAnnouncer";
import { useEngine } from "@/hooks/useEngine";
import { useSound } from "@/hooks/useSound";
import { type ClockState, TIME_CONTROLS, formatMs, initClock, switchClock, timeLeft } from "@/lib/clock";
import { type CoachFeedback, type Threat, findThreat, gradeMove, nullMoveFen, pieceHint } from "@/lib/coach";
import { downloadText } from "@/lib/chess/export";
import { applyUci, parseUci, uciToSan } from "@/lib/chess/line";
import { parseSingleGame } from "@/lib/chess/pgn";
import { type Color, START_FEN } from "@/lib/chess/types";
import type { AnalysisSnapshot } from "@/lib/engine/engine";
import { winPercentFor } from "@/lib/engine/score";
import { PLAY_LEVELS, pickHumanMove } from "@/lib/play";
import { MOVE_CLASS_PHRASE, isError } from "@/lib/review/types";
import { StorageError, saveGame } from "@/lib/storage/db";

type Phase = "setup" | "playing" | "over";
type Mode = "normal" | "coach" | "friend";
type GameEnd = { result: "1-0" | "0-1" | "1/2-1/2"; reason: string } | null;

interface CoachOptions {
  evalBar: boolean;
  bestArrow: boolean;
  threats: boolean;
  feedback: boolean;
}

interface Ply {
  uci: string;
  san: string;
  from: string;
  to: string;
  color: Color;
  fenAfter: string;
}

const COACH_DEPTH = 14;
const COACH_TIME_MS = 1200;

const MODES = [
  { id: "normal", title: "Play with Bot", Icon: Swords },
  { id: "coach", title: "Play with Coach", Icon: GraduationCap },
  { id: "friend", title: "Play in Person", Icon: Users },
] as const;

/** An unfinished (or just finished) game, kept in this browser. */
interface SavedPlay {
  mode: Mode;
  level: number;
  color: Color;
  tcId: string;
  boardView: "flip" | "two" | "fixed";
  startFen: string;
  moves: string[];
  orientation: "white" | "black";
  feedback: Record<number, CoachFeedback>;
  end: GameEnd;
  clock: { remaining: Record<Color, number>; running: Color | null } | null;
  savedAt: number;
}

const PLAY_KEY = "tempo:play:v1";

function loadSavedPlay(): SavedPlay | null {
  try {
    const raw = localStorage.getItem(PLAY_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as SavedPlay;
    return Array.isArray(g.moves) && typeof g.startFen === "string" ? g : null;
  } catch {
    return null;
  }
}

function storeSavedPlay(g: SavedPlay): void {
  try {
    localStorage.setItem(PLAY_KEY, JSON.stringify(g));
  } catch {
    /* storage full or blocked: the game just isn't kept */
  }
}

function clearSavedPlay(): void {
  try {
    localStorage.removeItem(PLAY_KEY);
  } catch {
    /* ignore */
  }
}

/** Impure helpers kept outside the component (event-handler use only). */
const nowMs = () => performance.now();
const coinFlip = (): Color => (Math.random() < 0.5 ? "w" : "b");

const COACH_NAME = "Danish";
const COACH_AVATAR = "/bots/coach.svg?v=1";

const sideName = (c: Color) => (c === "w" ? "White" : "Black");

const TC_ICON = { none: Infinity, bullet: Zap, blitz: Flame, rapid: Timer, classical: Hourglass } as const;
const TC_COLOR = { none: "var(--ink-3)", bullet: "var(--c-blunder)", blitz: "var(--c-mistake)", rapid: "var(--c-best)", classical: "var(--c-only)" } as const;

/** King image in the chosen piece set (used on the Play-as tiles). */
function KingIcon({ color, set }: { color: Color; set: string }) {
  const code = `${color}K`;
  if (set === "classic") {
    const Piece = defaultPieces[code];
    return Piece ? <Piece /> : null;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={pieceUrl(set, code)} alt="" className="size-full" draggable={false} />;
}

export function PlayView() {
  const router = useRouter();
  const params = useSearchParams();
  const { settings } = useSettings();
  const [startFen, setStartFen] = useState(() => {
    const f = params.get("fen");
    return f && validateFen(f).ok ? new Chess(f).fen() : START_FEN;
  });

  // ---- setup ----------------------------------------------------------------
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("coach");
  const [level, setLevel] = useState(4);
  const [colorChoice, setColorChoice] = useState<"w" | "b" | "random">("w");
  const [color, setColor] = useState<Color>("w");
  const [tcId, setTcId] = useState("none");
  const [boardView, setBoardView] = useState<"flip" | "two" | "fixed">("flip");
  const [coachOpts, setCoachOpts] = useState<CoachOptions>({ evalBar: true, bestArrow: false, threats: true, feedback: true });

  // ---- game -----------------------------------------------------------------
  const [moves, setMoves] = useState<string[]>([]);
  const [view, setView] = useState<number | null>(null); // null = live position
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [end, setEnd] = useState<GameEnd>(null);
  const [thinking, setThinking] = useState(false);
  const [coachBusy, setCoachBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hintStage, setHintStage] = useState(0);
  /** Play in Person: side that offered a draw, waiting for the other to accept. */
  const [drawOffer, setDrawOffer] = useState<Color | null>(null);
  /** Resign asks for confirmation first. */
  const [confirmResign, setConfirmResign] = useState(false);
  /** An unfinished game saved in this browser, offered on the setup screen. */
  const [saved, setSaved] = useState<SavedPlay | null>(null);
  const [evals, setEvals] = useState<Record<string, AnalysisSnapshot>>({});
  const [threats, setThreats] = useState<Record<string, Threat | null>>({});
  const [feedback, setFeedback] = useState<Record<number, CoachFeedback>>({});

  const engine = useEngine();
  const sound = useSound();
  const gen = useRef(0); // bumps on new game / undo so stale async work is ignored
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const busy = useRef(false);

  const cfg = PLAY_LEVELS.find((l) => l.level === level) ?? PLAY_LEVELS[3];
  // In coach mode the opponent is the Coach, playing at the chosen rating.
  const opponentName = mode === "coach" ? COACH_NAME : cfg.name;
  const opponentAvatar = mode === "coach" ? COACH_AVATAR : cfg.avatar;
  // Coach games are for learning: always untimed.
  const tc = mode === "coach" ? TIME_CONTROLS[0] : (TIME_CONTROLS.find((t) => t.id === tcId) ?? TIME_CONTROLS[0]);
  const engineColor: Color = color === "w" ? "b" : "w";
  const coach = mode === "coach";
  const friend = mode === "friend";
  const autoFlip = friend && boardView === "flip";
  const twoBoards = friend && boardView === "two";

  // ---- derived positions ------------------------------------------------------
  const plies = useMemo<Ply[]>(() => {
    const c = new Chess(startFen);
    const out: Ply[] = [];
    for (const uci of moves) {
      const m = applyUci(c, uci);
      if (!m) break;
      out.push({ uci, san: m.san, from: m.from, to: m.to, color: m.color, fenAfter: c.fen() });
    }
    return out;
  }, [startFen, moves]);
  const fenAt = useCallback((n: number) => (n === 0 ? startFen : plies[n - 1].fenAfter), [plies, startFen]);
  const liveFen = fenAt(plies.length);
  const live = useMemo(() => new Chess(liveFen), [liveFen]);
  const shownPly = view ?? plies.length;
  const shownFen = fenAt(shownPly);
  const viewingHistory = view !== null && view !== plies.length;

  // ---- engine helpers (serialised) -------------------------------------------
  const exclusive = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(fn, fn);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const evaluate = useCallback(
    async (fen: string, depth = COACH_DEPTH, multiPv = 2): Promise<AnalysisSnapshot | null> => {
      if (engine.status.state !== "ready") return null;
      const eng = engine.status.engine;
      return exclusive(() => eng.analyze({ fen, depth, movetimeMs: COACH_TIME_MS, multiPv }));
    },
    [engine.status, exclusive],
  );

  // ---- clock (human players only) --------------------------------------------------
  const [clock, setClock] = useState<ClockState | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!clock?.running) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [clock?.running]);

  const finish = useCallback(
    (result: NonNullable<GameEnd>) => {
      gen.current++;
      if (engine.status.state === "ready") engine.status.engine.stop();
      setThinking(false);
      setEnd(result);
      setPhase("over");
      setClock((c) => (c ? switchClock(c, null, performance.now(), 0) : c));
      const youWon = (result.result === "1-0" && color === "w") || (result.result === "0-1" && color === "b");
      sound.play(result.result === "1/2-1/2" ? "draw" : youWon || friend ? "victory" : "defeat");
    },
    [engine.status, color, sound, friend],
  );

  // Flag fall.
  useEffect(() => {
    if (!clock?.running || phase !== "playing") return;
    const side = clock.running;
    if (timeLeft(clock, side, now) <= 0) {
      const t = setTimeout(
        () => finish({ result: side === "w" ? "0-1" : "1-0", reason: `${friend ? sideName(side) : "You"} ran out of time` }),
        0,
      );
      return () => clearTimeout(t);
    }
  }, [clock, now, phase, friend, finish]);

  // ---- game over detection ----------------------------------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    let result: NonNullable<GameEnd> | null = null;
    if (live.isCheckmate()) result = { result: live.turn() === "w" ? "0-1" : "1-0", reason: "Checkmate" };
    else if (live.isStalemate()) result = { result: "1/2-1/2", reason: "Stalemate" };
    else if (live.isInsufficientMaterial()) result = { result: "1/2-1/2", reason: "Insufficient material" };
    else if (live.isThreefoldRepetition()) result = { result: "1/2-1/2", reason: "Threefold repetition" };
    else if (live.isDraw()) result = { result: "1/2-1/2", reason: "50-move rule" };
    if (!result) return;
    const r = result;
    const t = setTimeout(() => finish(r), 0);
    return () => clearTimeout(t);
  }, [live, phase, finish]);

  // ---- sounds for new moves ---------------------------------------------------
  const lastCount = useRef(0);
  useEffect(() => {
    if (plies.length > lastCount.current) {
      const p = plies[plies.length - 1];
      if (!live.isGameOver()) sound.playSan(p.san);
    }
    lastCount.current = plies.length;
  }, [plies, live, sound]);

  // ---- main loop: coach grading, engine reply, coach preparation -------------
  useEffect(() => {
    if (friend || phase !== "playing" || live.isGameOver() || engine.status.state !== "ready" || busy.current) return;
    const myGen = gen.current;
    const stale = () => myGen !== gen.current;
    const turn = live.turn();

    if (turn === engineColor) {
      busy.current = true;
      let fired = false;
      const n = plies.length;
      const t = setTimeout(async () => {
        fired = true;
        setThinking(true);
        try {
          // 1. Coach: grade the move the player just made.
          const last = plies[n - 1];
          if (coach && last && last.color === color && !feedback[n]) {
            const fenBefore = fenAt(n - 1);
            const before = evals[fenBefore] ?? (await evaluate(fenBefore));
            const after = await evaluate(liveFen);
            if (stale()) return;
            if (before && after) {
              const fb = gradeMove(fenBefore, last.uci, before, after);
              setEvals((e) => ({ ...e, [fenBefore]: before, [liveFen]: after }));
              if (fb) setFeedback((f) => ({ ...f, [n]: fb }));
            }
          }
          // 2. Stockfish replies at the chosen strength (it has no clock).
          if (engine.status.state !== "ready") return;
          const eng = engine.status.engine;
          const snap = await exclusive(() =>
            eng.analyze({ fen: liveFen, movetimeMs: cfg.movetimeMs, depth: cfg.depth, strength: cfg.strength, multiPv: cfg.humanize?.topK }),
          );
          if (stale()) return;
          const engineBest = snap.bestmove ?? snap.lines[0]?.pv[0];
          const legal = new Chess(liveFen).moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ""}`);
          const best = cfg.humanize
            ? pickHumanMove(snap.lines.map((l) => l.pv[0]).filter(Boolean), legal, cfg.humanize)
            : engineBest;
          if (best && applyUci(new Chess(liveFen), best)) {
            // Only apply the reply to the exact position it was computed for.
            setMoves((m) => (m.length === n ? [...m, best] : m));
            setView(null);
            setClock((c) => (c ? switchClock(c, color, performance.now(), 0) : c));
          }
        } catch {
          if (!stale()) setError("The engine stopped responding.");
        } finally {
          busy.current = false;
          if (!stale()) setThinking(false);
        }
      }, 150);
      return () => {
        // Re-renders while the reply is being computed must not start a
        // second search; only cancel work that has not started yet.
        if (!fired) {
          clearTimeout(t);
          busy.current = false;
        }
      };
    }

    if (coach && !evals[liveFen]) {
      // 3. Coach: prepare the player's turn (eval, hints, threats).
      busy.current = true;
      let fired = false;
      const t = setTimeout(async () => {
        fired = true;
        setCoachBusy(true);
        try {
          const cur = await evaluate(liveFen);
          const nm = nullMoveFen(liveFen);
          const nmSnap = nm ? await evaluate(nm, 10, 1) : null;
          if (stale() || !cur) return;
          setEvals((e) => ({ ...e, [liveFen]: cur }));
          setThreats((th) => ({ ...th, [liveFen]: nmSnap ? findThreat(liveFen, color, cur, nmSnap) : null }));
        } finally {
          busy.current = false;
          if (!stale()) setCoachBusy(false);
        }
      }, 50);
      return () => {
        if (!fired) {
          clearTimeout(t);
          busy.current = false;
        }
      };
    }
  }, [phase, live, engine.status, engineColor, coach, friend, plies, feedback, evals, liveFen, color, fenAt, evaluate, exclusive, cfg, thinking, coachBusy]);

  useEffect(() => {
    if (!friend && phase === "playing" && engine.status.state === "idle") void engine.load();
  }, [phase, engine, friend]);

  // ---- actions ------------------------------------------------------------------
  const start = () => {
    const c: Color = colorChoice === "random" ? coinFlip() : colorChoice;
    const turn = new Chess(startFen).turn();
    gen.current++;
    setColor(c);
    setOrientation(friend ? (turn === "w" ? "white" : "black") : c === "w" ? "white" : "black");
    setMoves([]);
    setView(null);
    setEnd(null);
    setError(null);
    setNotice(null);
    setFeedback({});
    setEvals({});
    setThreats({});
    setHintStage(0);
    setDrawOffer(null);
    setConfirmResign(false);
    setThinking(false);
    setCoachBusy(false);
    busy.current = false;
    const t0 = nowMs();
    setNow(t0);
    // Only human players have a clock; vs the computer it pauses while Stockfish thinks.
    const firstRunning = friend || turn === c ? turn : null;
    setClock(tc.baseMs ? { ...initClock(tc.baseMs), running: firstRunning, since: t0 } : null);
    setPhase("playing");
    enterGameScreen();
  };

  /** Push a history entry for the game screen, so the browser Back button returns to setup. */
  const enterGameScreen = () => {
    if (new URLSearchParams(window.location.search).get("playing") === "1") return;
    const url = new URL(window.location.href);
    url.searchParams.set("playing", "1");
    window.history.pushState(window.history.state, "", url);
  };

  const backToSetup = () => {
    if (new URLSearchParams(window.location.search).get("playing") === "1") window.history.back();
    else setPhase("setup");
  };

  /** Restore a saved game (after Back, a reload, or visiting another page). */
  const resume = (g: SavedPlay) => {
    gen.current++;
    busy.current = false;
    setMode(g.mode);
    setLevel(g.level);
    setColor(g.color);
    setTcId(g.tcId);
    setBoardView(g.boardView);
    setStartFen(g.startFen);
    setMoves(g.moves);
    setOrientation(g.orientation);
    setFeedback(g.feedback);
    setEnd(g.end);
    setView(null);
    setEvals({});
    setThreats({});
    setHintStage(0);
    setDrawOffer(null);
    setConfirmResign(false);
    setThinking(false);
    setCoachBusy(false);
    const t0 = nowMs();
    setNow(t0);
    setClock(g.clock ? { remaining: g.clock.remaining, running: g.end ? null : g.clock.running, since: t0 } : null);
    setPhase(g.end ? "over" : "playing");
    enterGameScreen();
  };

  // On arrival: remember any saved game; resume it directly if the address says so.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    const g = loadSavedPlay();
    if (!g) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(g);
    if (params.get("playing") === "1") resume(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browser Back from the game screen returns to setup (the game stays saved).
  useEffect(() => {
    const onPop = () => {
      if (new URLSearchParams(window.location.search).get("playing") !== "1") {
        gen.current++;
        if (engine.status.state === "ready") engine.status.engine.stop();
        busy.current = false;
        setThinking(false);
        setSaved(loadSavedPlay());
        setPhase("setup");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [engine.status]);

  // Save the game after every change so leaving the page never loses it.
  useEffect(() => {
    if (phase === "setup") return;
    const at = performance.now();
    storeSavedPlay({
      mode,
      level,
      color,
      tcId,
      boardView,
      startFen,
      moves,
      orientation,
      feedback,
      end,
      clock: clock ? { remaining: { w: timeLeft(clock, "w", at), b: timeLeft(clock, "b", at) }, running: clock.running } : null,
      savedAt: Date.now(),
    });
    // Clock ticks are not saved individually; the latest values are saved with each move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, moves, end, feedback, orientation]);

  const onMove = (uci: string): boolean => {
    if (phase !== "playing" || thinking || viewingHistory || (!friend && live.turn() !== color)) return false;
    if (!applyUci(new Chess(liveFen), uci)) return false;
    const n = plies.length;
    const mover = live.turn();
    const next: Color = mover === "w" ? "b" : "w";
    setMoves((m) => (m.length === n ? [...m, uci] : m));
    setDrawOffer(null);
    setConfirmResign(false);
    setView(null);
    setHintStage(0);
    setNotice(null);
    setClock((c) => (c ? switchClock(c, friend ? next : null, performance.now(), tc.incrementMs) : c));
    if (friend && autoFlip) setOrientation(next === "w" ? "white" : "black");
    return true;
  };

  /** Undo: vs the computer, take back your last move and its reply; with a friend, one move. */
  const undo = () => {
    gen.current++;
    if (engine.status.state === "ready") engine.status.engine.stop();
    busy.current = false;
    setThinking(false);
    setCoachBusy(false);
    let n = plies.length - 1;
    if (!friend) while (n >= 0 && new Chess(fenAt(n)).turn() !== color) n--;
    const keep = Math.max(0, n);
    const toMove = new Chess(fenAt(keep)).turn();
    setMoves((m) => m.slice(0, keep));
    setFeedback((f) => Object.fromEntries(Object.entries(f).filter(([k]) => Number(k) <= keep)));
    setView(null);
    setHintStage(0);
    setDrawOffer(null);
    setConfirmResign(false);
    setEnd(null);
    setPhase("playing");
    setClock((c) => (c ? switchClock(c, friend ? toMove : color, performance.now(), 0) : c));
    if (friend && autoFlip) setOrientation(toMove === "w" ? "white" : "black");
  };

  const offerDraw = async () => {
    if (friend) {
      // Both players must agree: the side to move offers, the other accepts.
      setDrawOffer(live.turn());
      return;
    }
    setNotice("Stockfish is considering your offer…");
    const snap = await evaluate(liveFen, 12, 1);
    if (!snap?.lines[0]) {
      setNotice(null);
      return;
    }
    const engineWin = winPercentFor(snap.lines[0].score, engineColor);
    if (engineWin <= 52) finish({ result: "1/2-1/2", reason: "Draw agreed" });
    else setNotice("Stockfish declines the draw.");
  };

  /**
   * Abort is allowed before the game really starts: vs the computer until
   * you have made your first move; in person until both sides have moved.
   */
  const canAbort = phase === "playing" && (friend ? plies.length < 2 : !plies.some((p) => p.color === color));

  const abort = () => {
    gen.current++;
    if (engine.status.state === "ready") engine.status.engine.stop();
    busy.current = false;
    setThinking(false);
    setCoachBusy(false);
    setDrawOffer(null);
    setConfirmResign(false);
    setClock((c) => (c ? switchClock(c, null, performance.now(), 0) : c));
    clearSavedPlay();
    setSaved(null);
    backToSetup();
  };

  const resign = () => {
    const loser: Color = friend ? live.turn() : color;
    finish({ result: loser === "w" ? "0-1" : "1-0", reason: friend ? `${sideName(loser)} resigned` : "You resigned" });
  };

  const pgn = () => {
    const c = new Chess(startFen);
    for (const p of plies) applyUci(c, p.uci);
    c.setHeader("Event", friend ? "Tempo: friendly game" : `Tempo: vs Stockfish (${cfg.label})${coach ? " with Coach" : ""}`);
    c.setHeader("White", friend ? "White" : color === "w" ? "You" : `${opponentName} (Stockfish ${cfg.label})`);
    c.setHeader("Black", friend ? "Black" : color === "b" ? "You" : `${opponentName} (Stockfish ${cfg.label})`);
    c.setHeader("Date", new Date().toISOString().slice(0, 10).replace(/-/g, "."));
    if (tc.baseMs) c.setHeader("TimeControl", `${tc.baseMs / 1000}+${tc.incrementMs / 1000}`);
    c.setHeader("Result", end?.result ?? "*");
    if (end) c.setHeader("Termination", end.reason);
    return c.pgn();
  };

  const reviewGame = async () => {
    // Open the tab synchronously (inside the click) so popup blockers allow it.
    const tab = window.open("", "_blank");
    try {
      const game = parseSingleGame(pgn());
      await saveGame(game, friend ? {} : { perspective: color });
      const url = `/analyze?game=${encodeURIComponent(game.id)}`;
      if (tab) tab.location.href = url;
      else router.push(url);
    } catch (err) {
      tab?.close();
      setError(err instanceof StorageError ? err.message : "Could not open the game for review.");
    }
  };

  // ---- history navigation (view only) ---------------------------------------------
  const goView = useCallback(
    (n: number) => {
      const target = Math.max(0, Math.min(plies.length, n));
      if (target === shownPly + 1 && plies[target - 1]) sound.playSan(plies[target - 1].san);
      setView(target === plies.length ? null : target);
    },
    [plies, shownPly, sound],
  );

  useEffect(() => {
    if (phase === "setup") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.key === "ArrowLeft") goView(shownPly - 1);
      else if (e.key === "ArrowRight") goView(shownPly + 1);
      else if (e.key === "Home" || e.key === "ArrowUp") goView(0);
      else if (e.key === "End" || e.key === "ArrowDown") goView(plies.length);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, goView, shownPly, plies.length]);

  // ---- board decorations ------------------------------------------------------
  const liveEval = evals[liveFen];
  const shownEval = evals[shownFen];
  const myTurnLive = phase === "playing" && !viewingHistory && live.turn() === color && !thinking;
  const threat = coach && coachOpts.threats && myTurnLive ? threats[liveFen] : null;
  const hint = coach && myTurnLive && liveEval?.lines[0]?.pv[0] ? pieceHint(liveFen, liveEval.lines[0].pv[0]) : null;

  const arrows: BoardArrow[] = [];
  if (coach && myTurnLive && liveEval?.lines[0]?.pv[0] && (coachOpts.bestArrow || hintStage >= 2)) {
    const p = parseUci(liveEval.lines[0].pv[0]);
    if (p) arrows.push({ from: p.from, to: p.to, kind: "best" });
  }
  if (threat) arrows.push({ from: threat.from, to: threat.to, kind: "threat" });

  const shownFeedback = coach && coachOpts.feedback ? feedback[shownPly] : undefined;
  const badge = shownFeedback ? { square: shownFeedback.square, classification: shownFeedback.classification } : null;
  const highlights = hintStage === 1 && hint ? { [hint.square]: "hint" as const } : undefined;
  const lastPly = shownPly > 0 ? plies[shownPly - 1] : null;

  const latestFeedbackPly = (() => {
    for (let n = plies.length; n > 0; n--) if (feedback[n]) return n;
    return 0;
  })();
  const latestFeedback = latestFeedbackPly ? feedback[latestFeedbackPly] : null;
  const barScore = shownFeedback?.evalAfter ?? shownEval?.lines[0]?.score ?? liveEval?.lines[0]?.score ?? null;
  const terminal = new Chess(shownFen);
  const terminalWinner = terminal.isCheckmate() ? (terminal.turn() === "w" ? "b" : "w") : terminal.isDraw() || terminal.isStalemate() ? "draw" : null;

  // ---- render: setup -------------------------------------------------------------
  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {saved && !saved.end ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">Unfinished game</p>
              <p className="text-sm text-ink-2">
                {saved.mode === "friend" ? "Play in Person" : saved.mode === "coach" ? "Play with Coach" : "Play with Bot"} · move{" "}
                {Math.max(1, Math.ceil(saved.moves.length / 2))}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => resume(saved)}>
                <RotateCcw className="size-4" aria-hidden /> Resume game
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  clearSavedPlay();
                  setSaved(null);
                }}
              >
                Discard
              </Button>
            </div>
          </Card>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Game mode">
          {MODES.map(({ id, title, Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => setMode(id)}
              className={cx(
                "card relative flex flex-col items-start gap-2 p-4 text-left transition-colors",
                mode === id ? "!border-accent bg-accent-soft ring-2 ring-accent" : "opacity-80 hover:bg-surface-2 hover:opacity-100",
              )}
            >
              {mode === id ? (
                <span className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-accent text-accent-ink" aria-hidden>
                  <Check className="size-4" />
                </span>
              ) : null}
              <Icon className="size-6 text-accent" aria-hidden />
              <span className="font-semibold">{title}</span>
            </button>
          ))}
        </div>

        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink-2">{startFen !== START_FEN ? "Starting from a custom position." : "Starting from the initial position."}</span>
            <span className="flex gap-3">
              {startFen !== START_FEN ? (
                <button type="button" className="text-ink-2 underline" onClick={() => { setStartFen(START_FEN); setQuery({ fen: null }); }}>
                  Reset
                </button>
              ) : null}
              <Link href={`/editor?fen=${encodeURIComponent(startFen)}`} className="text-ink-2 underline">
                Set up position
              </Link>
            </span>
          </div>
          {!friend ? (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Play as</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["w", "random", "b"] as const).map((c) => (
                    <label
                      key={c}
                      className={cx(
                        "flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)]",
                        colorChoice === c ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
                      )}
                    >
                      <input type="radio" name="color" className="sr-only" checked={colorChoice === c} onChange={() => setColorChoice(c)} />
                      <span className="relative block size-12" aria-hidden>
                        {c === "random" ? (
                          <>
                            <span className="absolute inset-0 overflow-hidden" style={{ clipPath: "inset(0 50% 0 0)" }}>
                              <KingIcon color="w" set={settings.pieceSet} />
                            </span>
                            <span className="absolute inset-0 overflow-hidden" style={{ clipPath: "inset(0 0 0 50%)" }}>
                              <KingIcon color="b" set={settings.pieceSet} />
                            </span>
                          </>
                        ) : (
                          <KingIcon color={c} set={settings.pieceSet} />
                        )}
                      </span>
                      <span className="font-medium">{c === "w" ? "White" : c === "b" ? "Black" : "Random"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {coach ? (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Coach strength</legend>
                  <div className="flex items-center gap-4 rounded-xl border border-border p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={COACH_AVATAR} alt="" className="size-16 shrink-0 rounded-full" draggable={false} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {COACH_NAME} <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink tabular">{cfg.rating}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Coach rating">
                        {PLAY_LEVELS.map((b) => (
                          <button
                            key={b.level}
                            type="button"
                            role="radio"
                            aria-checked={level === b.level}
                            onClick={() => setLevel(b.level)}
                            className={cx(
                              "rounded-full border px-2.5 py-1 text-xs font-semibold tabular transition-colors",
                              level === b.level ? "border-accent bg-accent text-accent-ink" : "border-border hover:bg-surface-2",
                            )}
                          >
                            {b.rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </fieldset>
              ) : (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Opponent</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Choose your opponent">
                    {PLAY_LEVELS.map((b) => (
                      <button
                        key={b.level}
                        type="button"
                        role="radio"
                        aria-checked={level === b.level}
                        onClick={() => setLevel(b.level)}
                        title={b.label}
                        className={cx(
                          "relative flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors",
                          level === b.level ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.avatar} alt="" className="size-16 rounded-full" draggable={false} />
                        <span className="text-sm font-semibold leading-tight">{b.name}</span>
                        <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular", level === b.level ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2")}>
                          {b.rating}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </>
          ) : (
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Board view</legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["flip", "Flip each move", RefreshCw],
                    ["two", "Two boards", Columns2],
                    ["fixed", "Fixed", Lock],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <label
                    key={id}
                    className={cx(
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)]",
                      boardView === id ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
                    )}
                  >
                    <input type="radio" name="boardView" className="sr-only" checked={boardView === id} onChange={() => setBoardView(id)} />
                    <Icon className="size-6 text-accent" aria-hidden />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {mode !== "coach" ? (
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Time control</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {TIME_CONTROLS.map((t) => {
                const Icon = TC_ICON[t.kind];
                return (
                  <label
                    key={t.id}
                    className={cx(
                      "flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)]",
                      tcId === t.id ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
                    )}
                  >
                    <input type="radio" name="tc" className="sr-only" checked={tcId === t.id} onChange={() => setTcId(t.id)} />
                    <Icon className="size-5" style={{ color: TC_COLOR[t.kind] }} aria-hidden />
                    <span className="text-xs font-semibold">{t.label}</span>
                    <span className="text-[10px] capitalize text-ink-3">{t.kind === "none" ? "untimed" : t.kind}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          ) : null}
          <Button variant="primary" size="lg" className="w-full" onClick={start}>
            Start
          </Button>
        </Card>
      </div>
    );
  }

  // ---- render: game -------------------------------------------------------------
  const renderClock = (side: Color) =>
    clock && (friend || side === color) ? (
      <span
        className={cx(
          "rounded-md px-2.5 py-1 font-mono text-base tabular",
          clock.running === side ? "bg-ink text-bg" : "bg-surface-2 text-ink-2",
          timeLeft(clock, side, Math.max(now, clock.since)) < 20_000 && "text-bad",
        )}
        aria-label={`${friend ? sideName(side) : "Your"} clock`}
      >
        {formatMs(timeLeft(clock, side, Math.max(now, clock.since)))}
      </span>
    ) : null;

  const renderPlayer = (side: Color) => {
    const isOpponent = !friend && side !== color;
    const name = friend ? sideName(side) : isOpponent ? opponentName : "You";
    const sub = isOpponent ? `${cfg.rating} · ${sideName(side)}` : sideName(side);
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <span className="flex min-w-0 items-center gap-2.5">
          {isOpponent ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={opponentAvatar} alt="" className="size-10 shrink-0 rounded-lg" />
          ) : (
            <span
              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border"
              style={{ background: side === "w" ? "var(--eval-white)" : "var(--eval-black)" }}
              aria-hidden
            >
              {friend ? (
                <span className="block size-8">
                  <KingIcon color={side} set={settings.pieceSet} />
                </span>
              ) : (
                <UserRound className="size-6" style={{ color: side === "w" ? "var(--eval-black)" : "var(--eval-white)" }} />
              )}
            </span>
          )}
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">
              {name}
              {friend && phase === "playing" && live.turn() === side ? <span className="ml-2 text-xs font-normal text-ink-3">to move</span> : null}
              {isOpponent && thinking ? <span className="ml-2 text-xs font-normal text-ink-3">thinking…</span> : null}
            </span>
            <span className="block text-xs text-ink-3 tabular">{sub}</span>
          </span>
        </span>
        {renderClock(side)}
      </div>
    );
  };
  const topSide: Color = orientation === "white" ? "b" : "w";
  const resultTitle = !end
    ? ""
    : end.result === "1/2-1/2"
      ? "Draw"
      : friend
        ? `${end.result === "1-0" ? "White" : "Black"} won`
        : (end.result === "1-0") === (color === "w")
          ? "You won!"
          : `${opponentName} won`;

  return (
    <div className="grid gap-3 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
      <div className="flex min-h-0 flex-col items-center">
        <div className={cx("w-full", twoBoards ? "max-w-[min(100%,calc(2*(100dvh-17rem)))]" : "max-w-[min(100%,calc(100dvh-16rem))]")}>
          {twoBoards ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(["w", "b"] as const).map((side) => (
                <div key={side} className={cx("rounded-lg p-1", phase === "playing" && live.turn() === side && "ring-2 ring-accent")}>
                  {renderPlayer(side)}
                  <Board
                    id={`play-board-${side}`}
                    fen={shownFen}
                    orientation={side === "w" ? "white" : "black"}
                    lastMove={lastPly ? { from: lastPly.from, to: lastPly.to } : null}
                    onMove={onMove}
                    movableColor={side}
                    interactive={phase === "playing" && !viewingHistory && live.turn() === side}
                    ariaLabel={`${sideName(side)}'s board`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
              {renderPlayer(topSide)}
              <div className="flex gap-2">
                {coach && coachOpts.evalBar ? <EvalBar score={barScore} orientation={orientation} terminal={terminalWinner} /> : null}
                <div className="min-w-0 flex-1">
                  <Board
                    fen={shownFen}
                    orientation={orientation}
                    lastMove={lastPly ? { from: lastPly.from, to: lastPly.to } : null}
                    onMove={onMove}
                    movableColor={friend ? "both" : color}
                    interactive={phase === "playing" && !thinking && !viewingHistory}
                    arrows={arrows}
                    badge={badge}
                    highlights={highlights}
                    ariaLabel="Play board"
                  />
                </div>
              </div>
              {renderPlayer(topSide === "w" ? "b" : "w")}
            </>
          )}
          <div className="flex flex-wrap items-center justify-between gap-1">
            <div className="flex items-center" role="group" aria-label="View moves">
              <IconButton label="First move" onClick={() => goView(0)} disabled={shownPly === 0}>
                <ChevronFirst className="size-5" aria-hidden />
              </IconButton>
              <IconButton label="Previous move (←)" onClick={() => goView(shownPly - 1)} disabled={shownPly === 0}>
                <ChevronLeft className="size-5" aria-hidden />
              </IconButton>
              <IconButton label="Next move (→)" onClick={() => goView(shownPly + 1)} disabled={!viewingHistory}>
                <ChevronRight className="size-5" aria-hidden />
              </IconButton>
              <IconButton label="Latest move" onClick={() => goView(plies.length)} disabled={!viewingHistory}>
                <ChevronLast className="size-5" aria-hidden />
              </IconButton>
              {!twoBoards ? (
                <IconButton label="Flip board" onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>
                  <FlipVertical2 className="size-5" aria-hidden />
                </IconButton>
              ) : null}
            </div>
            {viewingHistory ? (
              <Button size="sm" variant="primary" onClick={() => goView(plies.length)}>
                Back to game
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        {phase === "over" && end ? (
          <Card className="space-y-2 p-4" aria-live="polite">
            <p className="font-serif text-2xl font-semibold">{resultTitle}</p>
            <p className="text-sm text-ink-2">{end.reason}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void reviewGame()}>
                <Search className="size-4" aria-hidden /> Review this game
              </Button>
              <Button onClick={start}>
                <RotateCcw className="size-4" aria-hidden /> Rematch
              </Button>
              <Button onClick={backToSetup}>New game</Button>
            </div>
          </Card>
        ) : null}

        {coach ? (
          <Card className="space-y-3 p-4" aria-live="polite">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={COACH_AVATAR} alt="" className="size-8 rounded-full" />
                <SectionTitle>{COACH_NAME} · {cfg.rating}</SectionTitle>
              </span>
              {coachBusy || (thinking && plies[plies.length - 1]?.color === color && !feedback[plies.length]) ? <Spinner label="Thinking…" /> : null}
            </div>
            {latestFeedback ? (
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: `color-mix(in srgb, ${moveClassColor(latestFeedback.classification)} 45%, transparent)`,
                  background: `color-mix(in srgb, ${moveClassColor(latestFeedback.classification)} 7%, transparent)`,
                }}
              >
                <p className="flex items-center gap-2 font-semibold">
                  <MoveClassIcon classification={latestFeedback.classification} className="size-5" />
                  <span className="font-mono">{plies[latestFeedbackPly - 1]?.san}</span>
                  <span style={{ color: moveClassColor(latestFeedback.classification) }}>{MOVE_CLASS_PHRASE[latestFeedback.classification]}</span>
                </p>
                <p className="mt-1 text-sm">{latestFeedback.explanation.text}</p>
                {isError(latestFeedback.classification) && phase === "playing" ? (
                  <Button size="sm" variant="primary" className="mt-2" onClick={undo}>
                    <Undo2 className="size-4" aria-hidden /> Undo &amp; try again
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-ink-2">Make your move — I&apos;ll comment on each one.</p>
            )}
            {threat ? <Alert tone="warning">{threat.text}</Alert> : null}
            {hintStage === 1 && hint ? <Alert tone="info">{hint.text}</Alert> : null}
            {hintStage >= 2 && liveEval?.lines[0] ? (
              <Alert tone="info">
                Best move: <span className="font-mono">{uciToSan(liveFen, liveEval.lines[0].pv[0]) ?? "–"}</span>
              </Alert>
            ) : null}
            <Button size="sm" onClick={() => setHintStage((h) => Math.min(2, h + 1))} disabled={!myTurnLive || !liveEval || hintStage >= 2}>
              <Lightbulb className="size-4" aria-hidden /> {hintStage === 0 ? "Hint" : "Show the move"}
            </Button>
            <details>
              <summary className="cursor-pointer text-xs text-ink-3">Coach settings</summary>
              <Toggle label="Evaluation bar" checked={coachOpts.evalBar} onChange={(v) => setCoachOpts((o) => ({ ...o, evalBar: v }))} />
              <Toggle label="Move feedback" checked={coachOpts.feedback} onChange={(v) => setCoachOpts((o) => ({ ...o, feedback: v }))} />
              <Toggle label="Threat arrows (red)" checked={coachOpts.threats} onChange={(v) => setCoachOpts((o) => ({ ...o, threats: v }))} />
              <Toggle label="Best-move arrow (green)" checked={coachOpts.bestArrow} onChange={(v) => setCoachOpts((o) => ({ ...o, bestArrow: v }))} />
            </details>
          </Card>
        ) : null}

        <Card className="flex min-h-0 flex-1 flex-col p-3">
          <SectionTitle className="mb-2">Moves</SectionTitle>
          <ol className="min-h-0 flex-1 overflow-y-auto font-mono text-sm" aria-label="Moves">
            {Array.from({ length: Math.ceil(plies.length / 2) + (new Chess(startFen).turn() === "b" ? 1 : 0) }).map((_, row) => {
              const offset = new Chess(startFen).turn() === "b" ? 1 : 0;
              const wIdx = row * 2 - offset;
              const cells = [wIdx, wIdx + 1];
              const moveNo = (Number(startFen.split(" ")[5]) || 1) + row;
              return (
                <li key={row} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-1">
                  <span className="text-right text-xs text-ink-3">{moveNo}.</span>
                  {cells.map((i) => {
                    const p = i >= 0 ? plies[i] : undefined;
                    if (!p) return <span key={i} />;
                    const fb = feedback[i + 1];
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => goView(i + 1)}
                        aria-current={shownPly === i + 1 ? "step" : undefined}
                        className={cx("flex items-center gap-1 rounded px-2 py-0.5 text-left", shownPly === i + 1 ? "bg-accent text-accent-ink" : "hover:bg-surface-2")}
                      >
                        {fb && coach && coachOpts.feedback ? <MoveClassIcon classification={fb.classification} className={cx("size-3.5", shownPly === i + 1 && "!text-accent-ink")} /> : null}
                        {p.san}
                      </button>
                    );
                  })}
                </li>
              );
            })}
          </ol>
          {notice ? <p className="mt-2 text-sm text-ink-2">{notice}</p> : null}
          {error ? <Alert tone="error" className="mt-2">{error}</Alert> : null}
          {!friend && engine.status.state === "loading" ? <Spinner label="Loading Stockfish…" /> : null}
          {!friend && engine.status.state === "error" ? (
            <Alert tone="error" className="mt-2" action={<Button size="sm" onClick={() => void engine.retry()}>Retry</Button>}>
              {engine.status.message}
            </Alert>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" onClick={undo} disabled={plies.length === 0 || (!friend && !plies.some((p) => p.color === color))}>
              <Undo2 className="size-4" aria-hidden /> Undo
            </Button>
            {canAbort ? (
              <Button size="sm" variant="danger" onClick={abort}>
                <X className="size-4" aria-hidden /> Abort
              </Button>
            ) : phase === "playing" ? (
              <>
                {friend && drawOffer ? (
                  <span className="flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-2 py-1 text-sm" role="alert">
                    <Handshake className="size-4" aria-hidden />
                    {sideName(drawOffer)} offers a draw.
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setDrawOffer(null);
                        finish({ result: "1/2-1/2", reason: "Draw agreed" });
                      }}
                    >
                      {sideName(drawOffer === "w" ? "b" : "w")} accepts
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDrawOffer(null)}>
                      Decline
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" onClick={() => void offerDraw()} disabled={plies.length < 2}>
                    <Handshake className="size-4" aria-hidden /> {friend ? `${sideName(live.turn())} offers draw` : "Offer draw"}
                  </Button>
                )}
                {confirmResign ? (
                  <span className="flex items-center gap-2 rounded-lg border border-bad/40 bg-bad-soft px-2 py-1 text-sm" role="alert">
                    {friend ? `${sideName(live.turn())} resigns?` : "Resign the game?"}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setConfirmResign(false);
                        resign();
                      }}
                    >
                      Yes, resign
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmResign(false)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setConfirmResign(true)}>
                    <Flag className="size-4" aria-hidden /> {friend ? `${sideName(live.turn())} resigns` : "Resign"}
                  </Button>
                )}
              </>
            ) : null}
            <Button size="sm" variant="ghost" onClick={async () => setNotice((await copyText(pgn())) ? "PGN copied." : "Copy failed.")} disabled={plies.length === 0} aria-label="Copy PGN">
              <ClipboardCopy className="size-4" aria-hidden />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => downloadText("tempo-game.pgn", pgn())} disabled={plies.length === 0} aria-label="Download PGN">
              <Download className="size-4" aria-hidden />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
