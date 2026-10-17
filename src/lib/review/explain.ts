import { Chess, type Square } from "chess.js";
import { PIECE_NAME, PIECE_VALUE, describeMaterial, materialBalance } from "@/lib/chess/material";
import { type LineStep, formatSanLine, playLine } from "@/lib/chess/line";
import type { Color, PieceSymbol } from "@/lib/chess/types";
import { type Score, forPlayer, formatScore } from "@/lib/engine/score";
import type { MoveClass, MoveExplanation } from "./types";

/**
 * Deterministic, engine-grounded explanations.
 *
 * Rules:
 *  - Every tactical claim (fork, pin, hanging piece, mate) is checked against
 *    a concrete, legal engine line AND must coincide with an actual material
 *    change or checkmate along that line. Geometry alone is never enough.
 *  - When nothing can be verified, a neutral comparison is used instead.
 */
export interface ExplainInput {
  mover: Color;
  classification: MoveClass;
  fenBefore: string;
  fenAfter: string;
  playedSan: string;
  playedUci: string;
  evalBefore: Score;
  evalAfter: Score;
  /** Engine best line from fenBefore (UCI). */
  bestLine: string[];
  /** Engine line from fenAfter, i.e. the opponent's best reply onward (UCI). */
  replyLine: string[];
  deliversMate: boolean;
}

const LOOKAHEAD = 8;
const opposite = (c: Color): Color => (c === "w" ? "b" : "w");

/**
 * Material balance for `player` at the last "quiet" point within the first
 * LOOKAHEAD plies of a line: the latest position whose following move is not
 * a capture, so we never measure in the middle of an exchange. `steps` may
 * extend beyond the window so a recapture just outside it is still seen.
 */
function quietBalance(startFen: string, steps: LineStep[], player: Color): number {
  const window = Math.min(steps.length, LOOKAHEAD);
  for (let i = window - 1; i >= 0; i--) {
    const next = steps[i + 1];
    if (!next || !next.move.captured) return materialBalance(steps[i].fen, player);
  }
  return materialBalance(startFen, player);
}

function pieceName(p: string | undefined): string {
  return PIECE_NAME[(p ?? "p") as PieceSymbol] ?? "piece";
}

/** Squares holding `victimColor` pieces worth ≥3 (or the king) attacked by the piece on `from`. */
function forkTargets(fen: string, from: Square, victimColor: Color): { square: Square; piece: PieceSymbol }[] {
  const chess = new Chess(fen);
  const attacker = chess.get(from);
  if (!attacker) return [];
  const targets: { square: Square; piece: PieceSymbol }[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== victimColor) continue;
      const valuable = cell.type === "k" || PIECE_VALUE[cell.type] > PIECE_VALUE[attacker.type] || cell.type === "r" || cell.type === "q";
      if (!valuable) continue;
      if (chess.attackers(cell.square, attacker.color).includes(from)) {
        targets.push({ square: cell.square, piece: cell.type });
      }
    }
  }
  return targets;
}

/** Is the `victimColor` piece on `square` absolutely pinned to its king? */
function isPinnedToKing(fen: string, square: Square, victimColor: Color): boolean {
  const chess = new Chess(fen);
  const piece = chess.get(square);
  if (!piece || piece.color !== victimColor || piece.type === "k") return false;
  const kingSq = chess.findPiece({ type: "k", color: victimColor })[0];
  if (!kingSq) return false;
  const attacker = opposite(victimColor);
  if (chess.isAttacked(kingSq, attacker)) return false;
  chess.remove(square);
  return chess.isAttacked(kingSq, attacker);
}

function isBackRankMate(steps: LineStep[], victim: Color): boolean {
  const last = steps[steps.length - 1];
  if (!last) return false;
  const chess = new Chess(last.fen);
  if (!chess.isCheckmate()) return false;
  const kingSq = chess.findPiece({ type: "k", color: victim })[0];
  const backRank = victim === "w" ? "1" : "8";
  const mover = last.move;
  return Boolean(kingSq?.endsWith(backRank)) && (mover.piece === "r" || mover.piece === "q") && mover.to.endsWith(backRank);
}

function mateDistance(score: Score, player: Color): number | null {
  const s = forPlayer(score, player);
  return s.kind === "mate" && s.value !== 0 ? s.value : null;
}

function evalPhrase(score: Score): string {
  return formatScore(score);
}

/** Look for a verified tactic in the opponent's reply line after a mistake. */
function explainOpponentTactic(input: ExplainInput, replySteps: LineStep[], lossPoints: number): MoveExplanation | null {
  const { mover, fenAfter } = input;
  const opp = opposite(mover);
  const first = replySteps[0];
  if (!first) return null;
  const replySan = formatSanLine(fenAfter, replySteps.slice(0, 3).map((s) => s.move.san));
  const material = describeMaterial(lossPoints);

  // Hanging piece: the reply captures a piece that had no defenders.
  if (first.move.captured && first.move.captured !== "p") {
    const defenders = new Chess(fenAfter).attackers(first.move.to, mover);
    if (defenders.length === 0) {
      return {
        text: `This leaves your ${pieceName(first.move.captured)} on ${first.move.to} undefended — it can be taken with ${first.move.san}, losing ${material}.`,
        motifs: ["hanging-piece", "material-loss"],
        verified: true,
      };
    }
  }

  // Fork: the replying piece attacks two valuable targets, and material is
  // actually lost later in the line on one of those squares.
  const targets = forkTargets(first.fen, first.move.to, mover);
  if (targets.length >= 2) {
    const targetSquares = new Set(targets.map((t) => t.square));
    const wonOnTarget = replySteps.slice(1, LOOKAHEAD).some((s) => s.move.color === opp && s.move.captured && targetSquares.has(s.move.to));
    if (wonOnTarget) {
      const names = targets.slice(0, 2).map((t) => `${pieceName(t.piece)} on ${t.square}`).join(" and ");
      return {
        text: `This allows ${first.move.san}, a ${pieceName(first.move.piece)} fork hitting your ${names}. You lose ${material}.`,
        motifs: ["fork", "material-loss"],
        verified: true,
      };
    }
  }

  // Pin: after the reply one of the mover's pieces is pinned and is later captured.
  for (const step of replySteps.slice(1, LOOKAHEAD)) {
    if (step.move.color !== opp || !step.move.captured) continue;
    const idx = replySteps.indexOf(step);
    const prevFen = replySteps[idx - 1]?.fen ?? fenAfter;
    if (isPinnedToKing(prevFen, step.move.to, mover) && step.move.captured !== "p") {
      return {
        text: `After ${replySan}, your ${pieceName(step.move.captured)} on ${step.move.to} is pinned to your king and is lost (${material}).`,
        motifs: ["pin", "material-loss"],
        verified: true,
      };
    }
  }

  // Promotion
  const promo = replySteps.slice(0, LOOKAHEAD).find((s) => s.move.color === opp && s.move.promotion);
  if (promo) {
    return {
      text: `This lets your opponent push a pawn through to promote (${promo.move.san}), costing ${material}.`,
      motifs: ["promotion", "material-loss"],
      verified: true,
    };
  }

  return {
    text: `This loses ${material}: after ${replySan} your opponent comes out ahead.`,
    motifs: ["material-loss"],
    verified: true,
  };
}

export function explainMove(input: ExplainInput): MoveExplanation {
  const { mover, classification, fenBefore, fenAfter, evalBefore, evalAfter } = input;
  const opp = opposite(mover);

  if (input.deliversMate) return { text: "Checkmate.", motifs: [], verified: true };
  if (classification === "forced") return { text: "This was the only legal move.", motifs: [], verified: true };
  if (classification === "book") return { text: "A recognised opening move from the opening database.", motifs: [], verified: true };

  const bestSteps = playLine(fenBefore, input.bestLine, LOOKAHEAD + 4);
  const replySteps = playLine(fenAfter, input.replyLine, LOOKAHEAD + 4);
  const bestSan = bestSteps[0]?.move.san ?? null;
  const bestLineText = bestSan ? formatSanLine(fenBefore, bestSteps.slice(0, 4).map((s) => s.move.san)) : "";

  const oppMateAfter = mateDistance(evalAfter, opp);
  const myMateBefore = mateDistance(evalBefore, mover);
  const myMateAfter = mateDistance(evalAfter, mover);

  // 1. Allowing a forced mate.
  if (oppMateAfter !== null && oppMateAfter > 0 && mateDistance(evalBefore, opp) === null) {
    const fullLine = playLine(fenAfter, input.replyLine);
    const confirmed = fullLine.length > 0 && new Chess(fullLine[fullLine.length - 1].fen).isCheckmate();
    const backRank = confirmed && isBackRankMate(fullLine, mover);
    const how = confirmed ? ` — ${formatSanLine(fenAfter, fullLine.map((s) => s.move.san))}` : "";
    return {
      text: `This allows a forced ${backRank ? "back-rank " : ""}checkmate in ${oppMateAfter}${how}.`,
      motifs: backRank ? ["allows-mate", "back-rank"] : ["allows-mate"],
      verified: confirmed,
    };
  }

  // 2. Missing a forced mate.
  if (myMateBefore !== null && myMateBefore > 0 && myMateAfter === null && classification !== "best" && classification !== "only") {
    return {
      text: `You had a forced checkmate in ${myMateBefore}${bestSan ? ` starting with ${bestSan}` : ""}.`,
      motifs: ["missed-mate"],
      verified: bestSteps.length > 0,
    };
  }

  // Material outcomes along the engine lines (mover's perspective).
  const balanceNow = materialBalance(fenBefore, mover);
  const playedOutcome = quietBalance(fenAfter, replySteps, mover);
  const bestOutcome = quietBalance(fenBefore, bestSteps, mover);

  const isError = classification === "inaccuracy" || classification === "mistake" || classification === "blunder" || classification === "missed-win";

  if (isError) {
    const lostVsNow = balanceNow - playedOutcome;
    const lostVsBest = bestOutcome - playedOutcome;
    if (lostVsNow >= 1 && lostVsBest >= 1) {
      const tactic = explainOpponentTactic(input, replySteps, Math.max(lostVsNow, lostVsBest));
      if (tactic) {
        return bestSan ? { ...tactic, text: `${tactic.text} Better was ${bestSan}.` } : tactic;
      }
    }
    if (bestOutcome - balanceNow >= 2 && lostVsBest >= 2 && bestSan) {
      const forkAfterBest = bestSteps[0] ? forkTargets(bestSteps[0].fen, bestSteps[0].move.to, opp) : [];
      const viaFork = forkAfterBest.length >= 2;
      return {
        text: `This misses ${viaFork ? "a fork with" : "a way to win material with"} ${bestSan}, gaining ${describeMaterial(bestOutcome - balanceNow)} (${bestLineText}).`,
        motifs: viaFork ? ["fork", "missed-material"] : ["missed-material"],
        verified: true,
      };
    }
    if (classification === "missed-win") {
      return {
        text: `A winning position slips away. ${bestSan ? `${bestSan} kept a decisive advantage (${evalPhrase(evalBefore)}); ` : ""}after this move the engine rates it ${evalPhrase(evalAfter)}.`,
        motifs: [],
        verified: false,
      };
    }
    if (myMateBefore === null && playedOutcome - balanceNow <= -1 && lostVsBest < 1) {
      return {
        text: `The material stays level but the engine dislikes the resulting position (${evalPhrase(evalBefore)} → ${evalPhrase(evalAfter)}).${bestSan ? ` It prefers ${bestSan}.` : ""}`,
        motifs: [],
        verified: false,
      };
    }
    return {
      text: bestSan
        ? `The engine prefers ${bestSan} (${evalPhrase(evalBefore)}), evaluating the resulting position more favourably than after this move (${evalPhrase(evalAfter)}).`
        : `The engine evaluates the resulting position less favourably (${evalPhrase(evalAfter)}).`,
      motifs: [],
      verified: false,
    };
  }

  // Positive / neutral classifications.
  if (myMateAfter !== null && myMateAfter > 0) {
    return { text: `Strong — there is now a forced checkmate in ${myMateAfter}.`, motifs: ["mate-threat"], verified: true };
  }
  if (playedOutcome - balanceNow >= 2) {
    return { text: `This wins ${describeMaterial(playedOutcome - balanceNow)} by force.`, motifs: [], verified: true };
  }
  const afterCp = evalAfter.kind === "cp" ? evalAfter.value : null;
  const tail = afterCp !== null && Math.abs(afterCp) < 50 ? " The position remains approximately equal." : "";
  switch (classification) {
    case "only":
      return { text: `The only good move — the alternatives were clearly worse.${tail}`, motifs: [], verified: true };
    case "best":
      return { text: `The engine's top choice.${tail}`, motifs: [], verified: true };
    case "excellent":
      return { text: `Nearly as strong as the engine's top choice${bestSan ? ` (${bestSan})` : ""}.${tail}`, motifs: [], verified: true };
    default:
      return { text: `A reasonable move; ${bestSan ? `${bestSan} was slightly more precise` : "the engine had a slightly better option"}.${tail}`, motifs: [], verified: true };
  }
}
