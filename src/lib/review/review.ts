import type { ImportedGame } from "@/lib/chess/types";
import { legalMoveCount, sideToMove, terminalState, uciLineToSan } from "@/lib/chess/line";
import type { AnalysisRequest, AnalysisSnapshot } from "@/lib/engine/engine";
import type { Score } from "@/lib/engine/score";
import { type OpeningTable, identifyOpening } from "@/lib/openings";
import { gameAccuracy, moveAccuracy } from "./accuracy";
import { THRESHOLDS, classifyMove } from "./classify";
import { explainMove } from "./explain";
import { detectPhases } from "./phases";
import { isSacrifice } from "./sacrifice";
import { computeTimings, parseTimeControl } from "./time";
import {
  type GamePhase,
  type GameReview,
  type MoveReview,
  type PlayerSummary,
  type PositionEval,
  type ReviewSettings,
  REVIEW_VERSION,
  emptyCounts,
  isError,
} from "./types";

export const REVIEW_PRESETS: Record<ReviewSettings["preset"], ReviewSettings> = {
  quick: { preset: "quick", depth: 12, movetimeMs: 1500, multiPv: 2 },
  standard: { preset: "standard", depth: 16, movetimeMs: 4000, multiPv: 2 },
  deep: { preset: "deep", depth: 20, movetimeMs: 10000, multiPv: 2 },
};

/** Anything that can analyse a position (the real engine, or a test double). */
export interface Analyzer {
  analyze(request: AnalysisRequest): Promise<AnalysisSnapshot>;
  stop(): void;
}

export interface ReviewProgress {
  done: number;
  total: number;
  /** Ply index (0 = start position) of the position just analysed. */
  position: number;
}

export class ReviewCancelledError extends Error {
  constructor() {
    super("The review was cancelled.");
    this.name = "ReviewCancelledError";
  }
}

/** Synthetic score for terminal positions; mate 0 means "side to move is mated". */
function terminalScore(state: "checkmate" | "stalemate" | "draw"): Score {
  return state === "checkmate" ? { kind: "mate", value: 0 } : { kind: "cp", value: 0 };
}

export async function evaluatePosition(analyzer: Analyzer, fen: string, settings: ReviewSettings): Promise<PositionEval> {
  const terminal = terminalState(fen);
  if (terminal) {
    return { fen, lines: [], score: terminalScore(terminal), depth: 0, terminal, bestmove: null };
  }
  const snap = await analyzer.analyze({
    fen,
    depth: settings.depth,
    movetimeMs: settings.movetimeMs > 0 ? settings.movetimeMs : undefined,
    multiPv: settings.multiPv,
  });
  const top = snap.lines[0];
  return {
    fen,
    lines: snap.lines,
    score: top?.score ?? { kind: "cp", value: 0 },
    depth: snap.depth,
    terminal: null,
    bestmove: snap.bestmove,
  };
}

/** Score after a mating move, from White's POV, as a large but finite value. */
function scoreForMated(fen: string): Score {
  // Side to move in `fen` is mated; the other side won.
  return { kind: "mate", value: sideToMove(fen) === "w" ? -1 : 1 };
}

/**
 * Review a whole game: analyse every position, then classify and explain
 * each move. All results come from real engine output; no values are
 * synthesised except for terminal positions (mate / stalemate), which are
 * decided by the rules of chess.
 */
export async function runReview(
  game: ImportedGame,
  analyzer: Analyzer,
  settings: ReviewSettings,
  options: {
    engineName: string;
    openingTable: OpeningTable | null;
    signal?: AbortSignal;
    onProgress?: (p: ReviewProgress) => void;
    /** Previously computed position evals (e.g. resumed review), keyed by FEN. */
    cache?: Map<string, PositionEval>;
  },
): Promise<GameReview> {
  const fens = [game.startFen, ...game.moves.map((m) => m.fenAfter)];
  const positions: PositionEval[] = [];
  const onAbort = () => analyzer.stop();
  options.signal?.addEventListener("abort", onAbort);
  try {
    for (let i = 0; i < fens.length; i++) {
      if (options.signal?.aborted) throw new ReviewCancelledError();
      const cached = options.cache?.get(fens[i]);
      const pos = cached ?? (await evaluatePosition(analyzer, fens[i], settings));
      if (options.signal?.aborted) throw new ReviewCancelledError();
      options.cache?.set(fens[i], pos);
      positions.push(pos);
      options.onProgress?.({ done: i + 1, total: fens.length, position: i });
    }
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
  return buildReview(game, positions, settings, options.engineName, options.openingTable);
}

/** Pure function: turn position evaluations into a full review report. */
export function buildReview(
  game: ImportedGame,
  positions: PositionEval[],
  settings: ReviewSettings,
  engineName: string,
  openingTable: OpeningTable | null,
): GameReview {
  const opening = openingTable ? identifyOpening(openingTable, game.startFen, game.moves.map((m) => m.fenAfter)) : null;
  const bookPlies = opening?.bookPlies ?? 0;
  const phases = detectPhases(game.moves.map((m) => m.fenBefore), bookPlies);
  const timings = computeTimings(game.moves, parseTimeControl(game.metadata.timeControl));

  const moves: MoveReview[] = game.moves.map((mv, idx) => {
    const before = positions[idx];
    const after = positions[idx + 1];
    const deliversMate = after.terminal === "checkmate";
    const evalAfter = deliversMate ? scoreForMated(after.fen) : after.score;
    const result = classifyMove({
      mover: mv.color,
      playedUci: mv.uci,
      evalBefore: before.score,
      evalAfter,
      linesBefore: before.lines,
      legalMoveCount: legalMoveCount(mv.fenBefore),
      isBook: idx < bookPlies,
      deliversMate,
      isSacrifice: !deliversMate && isSacrifice(mv.fenBefore, mv.uci, after.lines[0]?.pv ?? []),
    });
    const bestLine = before.lines[0]?.pv ?? [];
    const replyLine = after.lines[0]?.pv ?? [];
    const bestMoveUci = bestLine[0] ?? null;
    const bestLineSan = uciLineToSan(mv.fenBefore, bestLine, 12);
    const timing = timings[idx];
    return {
      ply: mv.ply,
      moveNumber: mv.moveNumber,
      color: mv.color,
      san: mv.san,
      uci: mv.uci,
      classification: result.classification,
      evalBefore: before.score,
      evalAfter,
      winBefore: result.winBefore,
      winAfter: result.winAfter,
      winLoss: result.winLoss,
      accuracy: moveAccuracy(result.winLoss),
      bestMoveUci,
      bestMoveSan: bestLineSan[0] ?? null,
      bestLineSan,
      replyLineSan: uciLineToSan(mv.fenAfter, replyLine, 12),
      explanation: explainMove({
        mover: mv.color,
        classification: result.classification,
        fenBefore: mv.fenBefore,
        fenAfter: mv.fenAfter,
        playedSan: mv.san,
        playedUci: mv.uci,
        evalBefore: before.score,
        evalAfter,
        bestLine,
        replyLine,
        deliversMate,
      }),
      phase: phases[idx] ?? "middlegame",
      timeSpentSeconds: timing?.timeSpentSeconds,
      clockSeconds: timing?.clockSeconds,
      underTimePressure: timing?.underTimePressure ?? false,
      keyMoment: false,
    };
  });

  // "Miss": the opponent just made a mistake/blunder and this move hands the
  // advantage straight back (the mover ends no better than before the
  // opponent's error). Applied after per-move classification.
  for (let i = 1; i < moves.length; i++) {
    const prev = moves[i - 1];
    const cur = moves[i];
    if (prev.color === cur.color) continue;
    if (prev.classification !== "mistake" && prev.classification !== "blunder") continue;
    if (cur.classification !== "inaccuracy" && cur.classification !== "mistake" && cur.classification !== "blunder") continue;
    if (cur.winLoss < THRESHOLDS.inaccuracy) continue;
    const moverWinBeforeOpponentError = 100 - prev.winBefore;
    if (cur.winAfter <= moverWinBeforeOpponentError + 5) cur.classification = "missed-win";
  }

  // Key moments: the largest swings (≥ 10 win% lost) plus "only move" finds.
  const candidates = moves
    .filter((m) => m.winLoss >= 10 || m.classification === "only")
    .sort((a, b) => b.winLoss - a.winLoss)
    .slice(0, 8);
  const keyMomentPlies = candidates.map((m) => m.ply).sort((a, b) => a - b);
  for (const m of moves) m.keyMoment = keyMomentPlies.includes(m.ply);

  return {
    gameId: game.id,
    version: REVIEW_VERSION,
    settings,
    engineName,
    createdAt: Date.now(),
    positions,
    moves,
    white: summarize(moves.filter((m) => m.color === "w")),
    black: summarize(moves.filter((m) => m.color === "b")),
    opening: opening ? { eco: opening.eco, name: opening.name, bookPlies } : null,
    keyMomentPlies,
  };
}

/**
 * Bring a stored review up to the current rules without re-running the
 * engine: the raw engine evaluations (`positions`) are kept with every
 * review, so classifications are simply recomputed from them.
 */
export function upgradeReview(game: ImportedGame, review: GameReview, openingTable: OpeningTable | null): GameReview {
  if (review.version === REVIEW_VERSION) return review;
  const rebuilt = buildReview(game, review.positions, review.settings, review.engineName, openingTable);
  return { ...rebuilt, createdAt: review.createdAt };
}

export function summarize(moves: MoveReview[]): PlayerSummary {
  const counts = emptyCounts();
  for (const m of moves) counts[m.classification]++;
  const scored = moves.filter((m) => m.classification !== "forced");
  const phaseAccuracy = {} as Record<GamePhase, number | null>;
  for (const phase of ["opening", "middlegame", "endgame"] as GamePhase[]) {
    phaseAccuracy[phase] = gameAccuracy(scored.filter((m) => m.phase === phase).map((m) => m.accuracy));
  }
  return {
    accuracy: gameAccuracy(scored.map((m) => m.accuracy)),
    counts,
    phaseAccuracy,
    averageWinLoss: scored.length ? Math.round((scored.reduce((a, m) => a + m.winLoss, 0) / scored.length) * 10) / 10 : 0,
    movesAnalyzed: moves.length,
    timePressureErrors: moves.filter((m) => m.underTimePressure && isError(m.classification)).length,
  };
}
