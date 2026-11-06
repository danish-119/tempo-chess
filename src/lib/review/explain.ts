import { Chess, type Square } from "chess.js";
import { PIECE_NAME, PIECE_VALUE, describeMaterial, materialBalance } from "@/lib/chess/material";
import { type LineStep, formatSanLine, playLine } from "@/lib/chess/line";
import type { Color, PieceSymbol } from "@/lib/chess/types";
import { type Score, forPlayer } from "@/lib/engine/score";
import { type MoveFacts, moveFacts } from "./facts";
import { type Picker, capitalise, makePicker, standingSentence } from "./phrases";
import type { MotifTag, MoveClass, MoveExplanation } from "./types";

/**
 * Deterministic, engine-grounded explanations.
 *
 * Rules:
 *  - Every tactical claim (fork, pin, hanging piece, mate) is checked against
 *    a concrete, legal engine line AND must coincide with an actual material
 *    change or checkmate along that line. Geometry alone is never enough.
 *  - Descriptions of good moves (captures, checks, castling, threats, …) are
 *    plain board facts read with chess.js (see facts.ts), never guesses.
 *  - When nothing can be verified, a neutral comparison is used instead.
 *  - Wording is varied by a hash of the position and move (phrases.ts), so a
 *    given move always reads the same but different moves do not sound alike.
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

/** "a knight" / "an excellent" style article. */
function a(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
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

/** Centipawns from `player`'s point of view; null for mate scores. */
function cpFor(score: Score, player: Color): number | null {
  const s = forPlayer(score, player);
  return s.kind === "cp" ? s.value : null;
}

interface Ctx {
  input: ExplainInput;
  pick: Picker;
  facts: MoveFacts | null;
  bestSan: string | null;
  opp: Color;
}

/** Look for a verified tactic in the opponent's reply line after a mistake. */
function explainOpponentTactic(ctx: Ctx, replySteps: LineStep[], lossPoints: number): MoveExplanation | null {
  const { input, pick, facts } = ctx;
  const { mover, fenAfter, fenBefore } = input;
  const opp = opposite(mover);
  const first = replySteps[0];
  if (!first) return null;
  const replySan = formatSanLine(fenAfter, replySteps.slice(0, 3).map((s) => s.move.san));
  const material = describeMaterial(lossPoints);

  // Piece-winning capture on the very next move.
  if (first.move.captured && first.move.captured !== "p") {
    const sq = first.move.to;
    const name = pieceName(first.move.captured);
    const defenders = new Chess(fenAfter).attackers(sq, mover);
    const movedHere = Boolean(facts && sq === facts.move.to);
    const before = new Chess(fenBefore);

    if (defenders.length === 0) {
      // The move took away the only defender of that piece.
      if (facts && !movedHere && before.attackers(sq, mover).includes(facts.move.from)) {
        return {
          text: pick("remove-defender", [
            `Moving the ${pieceName(facts.move.piece)} abandons your ${name} on ${sq}, which it was guarding. That costs you ${material}.`,
            `The ${pieceName(facts.move.piece)} was the defender of your ${name} on ${sq}. Once it leaves, that ${name} is lost: ${material}.`,
            `This removes the guard from your ${name} on ${sq}, and you are down ${material}.`,
          ]),
          motifs: ["removed-defender", "hanging-piece", "material-loss"],
          verified: true,
        };
      }
      // The piece was already attacked and this move does nothing about it.
      if (!movedHere && before.attackers(sq, opp).length > 0) {
        return {
          text: pick("overlooked", [
            `Your ${name} on ${sq} was already under attack, and this move doesn't deal with it. It costs you ${material}.`,
            `The threat to your ${name} on ${sq} is ignored, and you lose ${material}.`,
            `You overlooked the attack on your ${name} on ${sq}. That costs you ${material}.`,
          ]),
          motifs: ["overlooked-threat", "hanging-piece", "material-loss"],
          verified: true,
        };
      }
      return {
        text: pick("hanging", [
          `This leaves your ${name} on ${sq} undefended, and you lose ${material}.`,
          `Your ${name} on ${sq} is left hanging, and you are down ${material}.`,
          `Nothing protects your ${name} on ${sq} after this, so it is lost: ${material}.`,
          `The ${name} on ${sq} has no defender, so it costs you ${material}.`,
        ]),
        motifs: ["hanging-piece", "material-loss"],
        verified: true,
      };
    }

    // The moved piece steps onto a square where it is taken, and the exchange still loses material.
    if (movedHere) {
      return {
        text: pick("walk-in", [
          `The ${name} on ${sq} can be captured, and even with a recapture you end up losing ${material}.`,
          `Putting the ${name} on ${sq} costs you ${material} in the exchange.`,
          `The exchange on ${sq} leaves you ${material} behind.`,
        ]),
        motifs: ["material-loss"],
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
      const attacker = pieceName(first.move.piece);
      return {
        text: pick("fork", [
          `This allows ${first.move.san}, a ${attacker} fork hitting your ${names}. You lose ${material}.`,
          `After ${first.move.san} the ${attacker} forks your ${names} — you cannot save both and lose ${material}.`,
          `A fork is coming: ${first.move.san} attacks your ${names} at once, and ${material} falls.`,
        ]),
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
      const name = pieceName(step.move.captured);
      return {
        text: pick("pin", [
          `After ${replySan}, your ${name} on ${step.move.to} is pinned to your king and is lost (${material}).`,
          `The ${name} on ${step.move.to} gets pinned against your king and cannot escape (${replySan}); you lose ${material}.`,
          `A pin decides it: following ${replySan}, your ${name} on ${step.move.to} can't move and falls, costing ${material}.`,
        ]),
        motifs: ["pin", "material-loss"],
        verified: true,
      };
    }
  }

  // Promotion
  const promo = replySteps.slice(0, LOOKAHEAD).find((s) => s.move.color === opp && s.move.promotion);
  if (promo) {
    return {
      text: pick("promo", [
        `This lets your opponent push a pawn through to promote (${promo.move.san}), costing ${material}.`,
        `A pawn gets through: ${promo.move.san} promotes, and you lose ${material}.`,
        `Your opponent can promote with ${promo.move.san} after this, which is worth ${material}.`,
      ]),
      motifs: ["promotion", "material-loss"],
      verified: true,
    };
  }

  return {
    text: pick("loses", [
      `This loses ${material}: after ${replySan} your opponent comes out ahead.`,
      `The line ${replySan} leaves you ${material} down.`,
      `Material goes the wrong way: ${replySan} and your opponent is ahead by ${material}.`,
      `It costs ${material} by force (${replySan}).`,
    ]),
    motifs: ["material-loss"],
    verified: true,
  };
}

/** What a good move actually does, from plain board facts. */
function describeGoodMove(ctx: Ctx, balanceNow: number): { clause: string; motifs: MotifTag[] } | null {
  const { facts, pick } = ctx;
  if (!facts) return null;
  const m = facts.move;
  const mp = pieceName(m.piece);
  const to = m.to;
  const withCheck = facts.givesCheck ? pick("with-check", [", with check", ", and it comes with check", " while giving check"]) : "";

  if (facts.capture) {
    const cp = pieceName(facts.capture.piece);
    const cv = PIECE_VALUE[facts.capture.piece];
    const mv = PIECE_VALUE[m.piece];
    if (facts.capture.free) {
      return {
        clause: pick("free-capture", [
          `You win a free ${cp} on ${to}${withCheck}`,
          `Takes the loose ${cp} on ${to} — nothing defends it${withCheck}`,
          `Picks up the undefended ${cp} on ${to}${withCheck}`,
          `Free material: the ${cp} on ${to} was unprotected${withCheck}`,
        ]),
        motifs: facts.givesCheck ? ["free-piece", "check"] : ["free-piece"],
      };
    }
    if (cv > mv) {
      return {
        clause: pick("win-exchange", [
          `Wins a ${cp} for a ${mp} on ${to}${withCheck}`,
          `The ${mp} takes the ${cp} on ${to}; even after a recapture you come out ahead${withCheck}`,
          `A favourable capture on ${to}: ${cp} for ${mp}${withCheck}`,
        ]),
        motifs: ["exchange"],
      };
    }
    const ahead = balanceNow >= 2;
    return {
      clause: ahead
        ? pick("trade-ahead", [
            `Trades ${mp} for ${cp} on ${to}${withCheck}. Exchanging pieces helps when you are ahead`,
            `An exchange on ${to}${withCheck}: simplifying while you are up material is sensible`,
          ])
        : pick("trade", [
            `Captures the ${cp} on ${to}${withCheck}, and the recapture keeps things balanced`,
            `An even exchange on ${to}: ${mp} for ${cp}${withCheck}`,
            `Takes on ${to}${withCheck} and the pieces come off`,
          ]),
      motifs: ahead ? ["exchange", "trade-down"] : ["exchange"],
    };
  }

  if (facts.promotion) {
    const pp = pieceName(facts.promotion);
    return {
      clause: pick("promotion", [`Promotes to ${a(pp)} on ${to}${withCheck}`, `The pawn reaches ${to} and becomes ${a(pp)}${withCheck}`, `Queening-race over: ${a(pp)} appears on ${to}${withCheck}`]),
      motifs: ["promotion"],
    };
  }

  if (facts.castle) {
    const side = facts.castle;
    return {
      clause:
        side === "king-side"
          ? pick("castle-short", [
              "Castles king-side: the king gets safe and the rook joins the game",
              "Castling short tucks the king away and connects the rooks",
              "Gets the king to safety with king-side castling",
            ])
          : pick("castle-long", [
              "Castles queen-side: the king is safe and the rook lands near the centre",
              "Castling long brings the rook to the d-file and the king out of the centre",
              "Queen-side castling secures the king and activates a rook",
            ]),
      motifs: ["castling"],
    };
  }

  if (facts.givesCheck) {
    return {
      clause: pick("check", [
        `Gives check with the ${mp}, forcing a reply`,
        `A check that keeps the initiative`,
        `The ${mp} checks the king on its way to ${to}`,
        `Check! The opponent has to respond before anything else`,
      ]),
      motifs: ["check"],
    };
  }

  if (facts.escapes) {
    return {
      clause: pick("escape", [
        `Moves the ${mp} out of danger`,
        `The ${mp} was under attack — this puts it on a safe square`,
        `Rescues the ${mp} that was in trouble`,
        `Saves the attacked ${mp} by relocating to ${to}`,
      ]),
      motifs: ["escape"],
    };
  }

  if (facts.attacks.length >= 2) {
    const [x, y] = facts.attacks;
    return {
      clause: pick("double", [
        `Double attack: the ${mp} hits the ${pieceName(x.piece)} on ${x.square} and the ${pieceName(y.piece)} on ${y.square}`,
        `The ${mp} now attacks both the ${pieceName(x.piece)} on ${x.square} and the ${pieceName(y.piece)} on ${y.square}`,
      ]),
      motifs: ["threat"],
    };
  }
  if (facts.attacks.length === 1) {
    const x = facts.attacks[0];
    const name = pieceName(x.piece);
    return {
      clause: pick("attack", [
        `The ${mp} now attacks the ${name} on ${x.square}`,
        `Creates a threat against the ${name} on ${x.square}`,
        `Puts pressure on the ${name} on ${x.square}`,
        `${capitalise(mp)} to ${to} eyes the ${name} on ${x.square}`,
      ]),
      motifs: ["threat"],
    };
  }

  if (facts.openFile) {
    return {
      clause: pick("open-file", [
        `Puts the rook on the open ${facts.openFile}-file`,
        `The rook takes control of the open ${facts.openFile}-file`,
        `A rook belongs on an open file — here the ${facts.openFile}-file`,
      ]),
      motifs: ["open-file"],
    };
  }

  if (facts.develops) {
    return {
      clause: pick("develop", [
        `Develops the ${mp} to ${to}`,
        `Brings the ${mp} into the game`,
        `Gets the ${mp} off the back rank and into play`,
        `Another piece developed: ${mp} to ${to}`,
      ]),
      motifs: ["development"],
    };
  }

  if (facts.centralPawn) {
    return {
      clause: pick("centre", [`Claims space in the centre with the pawn on ${to}`, `Fights for the centre with ${m.san}`, `A pawn to ${to} stakes a claim in the middle of the board`]),
      motifs: ["centre"],
    };
  }

  if (facts.passedPawnPush) {
    return {
      clause: pick("passed", [
        `Pushes the passed pawn to ${to}`,
        `The passed pawn advances to ${to}, tying the defence down`,
        `A passed pawn on the move: ${to}`,
      ]),
      motifs: ["passed-pawn"],
    };
  }

  if (facts.kingActivation) {
    return {
      clause: pick("king", [
        "Activates the king, a strong piece in the endgame",
        "The king steps toward the centre, which matters in endgames",
        "In the endgame the king should fight — and it does",
      ]),
      motifs: ["king-activity"],
    };
  }

  return null;
}

/** Closing remark that depends on the move's rating. */
function classTail(ctx: Ctx): string {
  const { input, pick, bestSan } = ctx;
  switch (input.classification) {
    case "only":
      return pick("tail-only", ["It was the only move that held things together.", "The alternatives were clearly worse.", "Everything else lost ground."]);
    case "best":
      return pick("tail-best", ["It's also my top choice.", "I like it: this is the best move.", "Exactly what I'd play here.", "Nothing better was available."]);
    case "excellent":
      return pick("tail-excellent", [
        bestSan ? `Nearly as strong as ${bestSan}, which is what I'd pick.` : "Almost as good as the move I'd pick.",
        `Just a hair behind the best move${bestSan ? ` (${bestSan})` : ""}.`,
        "A very accurate choice.",
      ]);
    default:
      return pick("tail-good", [
        bestSan ? `${bestSan} was slightly sharper, but this is fine.` : "Solid, though I'd have found something slightly better.",
        `A decent move; ${bestSan ?? "another move"} was a touch more precise.`,
        "Fine, if not the very best.",
      ]);
  }
}

function explainTerminal(ctx: Ctx, balanceNow: number): MoveExplanation | null {
  const { input, pick, facts } = ctx;
  if (!facts) return null;
  const san = input.playedSan;
  const beforeCp = cpFor(input.evalBefore, input.mover) ?? 0;

  if (input.deliversMate || facts.mate) {
    const kind = facts.mate ?? "other";
    if (kind === "back-rank") {
      return {
        text: pick("mate-back", ["Back-rank checkmate: the king has no squares to run to.", `${san} is a back-rank mate — the pawns in front of the king trapped it.`, "Checkmate on the back rank!"]),
        motifs: ["back-rank"],
        verified: true,
      };
    }
    if (kind === "smothered") {
      return {
        text: pick("mate-smothered", ["Smothered mate! The king is boxed in by its own pieces and the knight delivers the final blow.", `${san} — a smothered checkmate.`]),
        motifs: ["smothered-mate"],
        verified: true,
      };
    }
    return {
      text: pick("mate", ["Checkmate.", "Checkmate — the game is over.", `${san} delivers checkmate.`, "That's mate. Well played."]),
      motifs: [],
      verified: true,
    };
  }

  if (facts.stalemates) {
    if (beforeCp >= 100 || balanceNow >= 2) {
      return {
        text: pick("stalemate-bad", [
          "Stalemate! The opponent has no legal move but is not in check, so the game is drawn — a winning position thrown away.",
          "This is stalemate: a draw instead of the win you had.",
        ]),
        motifs: ["stalemate", "drawn-away"],
        verified: true,
      };
    }
    return {
      text: pick("stalemate-good", [
        "Stalemate — the game is drawn, rescuing a difficult position.",
        "A stalemate trick! Your opponent has no legal move and it is a draw, saving the game.",
      ]),
      motifs: ["stalemate"],
      verified: true,
    };
  }

  if (facts.drawsGame) {
    return beforeCp >= 100
      ? {
          text: pick("draw-bad", ["This ends the game as a draw (insufficient material or the fifty-move rule), though you were better.", "A draw by rule: a better position is given up."]),
          motifs: ["drawn-away"],
          verified: true,
        }
      : {
          text: pick("draw-ok", ["The game is drawn by rule (insufficient material or the fifty-move rule).", "A draw: the position cannot be won by either side."]),
          motifs: [],
          verified: true,
        };
  }
  return null;
}

export function explainMove(input: ExplainInput): MoveExplanation {
  const { mover, classification, fenBefore, fenAfter, evalBefore, evalAfter } = input;
  const opp = opposite(mover);
  const pick = makePicker(`${fenBefore}|${input.playedUci}|${classification}`);
  const facts = moveFacts(fenBefore, input.playedUci);

  const bestSteps = playLine(fenBefore, input.bestLine, LOOKAHEAD + 4);
  const replySteps = playLine(fenAfter, input.replyLine, LOOKAHEAD + 4);
  const bestSan = bestSteps[0]?.move.san ?? null;
  const bestLineText = bestSan ? formatSanLine(fenBefore, bestSteps.slice(0, 4).map((s) => s.move.san)) : "";
  const ctx: Ctx = { input, pick, facts, bestSan, opp };

  const balanceNow = materialBalance(fenBefore, mover);

  const terminal = explainTerminal(ctx, balanceNow);
  if (terminal) return terminal;

  if (classification === "forced") {
    return {
      text: facts?.inCheckBefore
        ? pick("forced-check", ["You were in check and this was the only legal way out.", "Check had to be answered, and this was the only legal reply."])
        : pick("forced", ["This was the only legal move.", "Nothing else was possible here — a forced move.", "The only legal move in the position."]),
      motifs: [],
      verified: true,
    };
  }
  if (classification === "book") {
    return {
      text: pick("book", [
        "A recognised opening move from the opening database.",
        "Still in the opening book — a well-known move here.",
        "A standard theory move; players have reached this position many times.",
        "Book move: nothing to criticise.",
      ]),
      motifs: [],
      verified: true,
    };
  }

  const oppMateAfter = mateDistance(evalAfter, opp);
  const myMateBefore = mateDistance(evalBefore, mover);
  const myMateAfter = mateDistance(evalAfter, mover);

  // 1. Allowing a forced mate.
  if (oppMateAfter !== null && oppMateAfter > 0 && mateDistance(evalBefore, opp) === null) {
    const fullLine = playLine(fenAfter, input.replyLine);
    const confirmed = fullLine.length > 0 && new Chess(fullLine[fullLine.length - 1].fen).isCheckmate();
    const backRank = confirmed && isBackRankMate(fullLine, mover);
    const how = confirmed ? ` — ${formatSanLine(fenAfter, fullLine.map((s) => s.move.san))}` : "";
    const base = backRank ? "back-rank checkmate" : "checkmate";
    return {
      text: pick("allow-mate", [
        `This allows a forced ${base} in ${oppMateAfter}${how}.`,
        `After this, your opponent has a forced ${base} in ${oppMateAfter}${how}.`,
        `Dangerous: it walks into a forced ${base} in ${oppMateAfter}${how}.`,
        `This leaves the king exposed — a forced ${base} in ${oppMateAfter} follows${how}.`,
      ]),
      motifs: backRank ? ["allows-mate", "back-rank"] : ["allows-mate"],
      verified: confirmed,
    };
  }

  // 2. Missing a forced mate.
  if (myMateBefore !== null && myMateBefore > 0 && myMateAfter === null && classification !== "best" && classification !== "only") {
    return {
      text: pick("missed-mate", [
        `You had a forced checkmate in ${myMateBefore}${bestSan ? ` starting with ${bestSan}` : ""}.`,
        `There was a forced mate in ${myMateBefore}${bestSan ? ` — ${bestSan} would have done it` : ""}, and it slipped by.`,
        `${bestSan ?? "A different move"} would have mated in ${myMateBefore}.`,
        `Checkmate in ${myMateBefore} was on the board${bestSan ? ` with ${bestSan}` : ""}.`,
      ]),
      motifs: ["missed-mate"],
      verified: bestSteps.length > 0,
    };
  }

  // Material outcomes along the engine lines (mover's perspective).
  const playedOutcome = quietBalance(fenAfter, replySteps, mover);
  const bestOutcome = quietBalance(fenBefore, bestSteps, mover);

  const isError = classification === "inaccuracy" || classification === "mistake" || classification === "blunder" || classification === "missed-win";

  if (isError) {
    const lostVsNow = balanceNow - playedOutcome;
    const lostVsBest = bestOutcome - playedOutcome;
    if (lostVsNow >= 1 && lostVsBest >= 1) {
      const tactic = explainOpponentTactic(ctx, replySteps, Math.max(lostVsNow, lostVsBest));
      if (tactic) {
        return bestSan
          ? { ...tactic, text: `${tactic.text} ${pick("better-was", [`Better was ${bestSan}.`, `${bestSan} avoided this.`, `I'd play ${bestSan} instead.`])}` }
          : tactic;
      }
    }
    if (bestOutcome - balanceNow >= 2 && lostVsBest >= 2 && bestSan) {
      const forkAfterBest = bestSteps[0] ? forkTargets(bestSteps[0].fen, bestSteps[0].move.to, opp) : [];
      const viaFork = forkAfterBest.length >= 2;
      const gain = describeMaterial(bestOutcome - balanceNow);
      return {
        text: viaFork
          ? pick("miss-fork", [
              `This misses a fork with ${bestSan}, gaining ${gain} (${bestLineText}).`,
              `${bestSan} forks two pieces and wins ${gain} (${bestLineText}) — it was available.`,
            ])
          : pick("miss-material", [
              `This misses a way to win material with ${bestSan}, gaining ${gain} (${bestLineText}).`,
              `${bestSan} would have won ${gain} (${bestLineText}).`,
              `A chance to win ${gain} was there: ${bestLineText}.`,
            ]),
        motifs: viaFork ? ["fork", "missed-material"] : ["missed-material"],
        verified: true,
      };
    }

    // A win that turns into a draw.
    const cpBefore = cpFor(evalBefore, mover);
    const cpAfter = cpFor(evalAfter, mover);
    if (cpBefore !== null && cpAfter !== null && cpBefore >= 250 && cpAfter > -60 && cpAfter < 60) {
      return {
        text: pick("drawn-away", [
          `The win slips away: you were clearly better and now the position is level.${bestSan ? ` ${bestSan} kept the advantage.` : ""}`,
          `A winning position has become a drawish one.${bestSan ? ` I'd have played ${bestSan}.` : ""}`,
          `You let the advantage go.${bestSan ? ` ${bestSan} would have kept the pressure on.` : ""}`,
        ]),
        motifs: ["drawn-away"],
        verified: false,
      };
    }

    if (classification === "missed-win") {
      return {
        text: pick("missed-win", [
          `A winning position slips away. ${bestSan ? `${bestSan} kept a decisive advantage; after this move it is much less clear.` : "After this move it is much less clear."}`,
          `This lets a won game get away${bestSan ? ` — ${bestSan} was the way to keep the full advantage` : ""}. It is much less clear now.`,
          `The win was there${bestSan ? ` with ${bestSan}` : ""}, but this move lets it slip.`,
        ]),
        motifs: [],
        verified: false,
      };
    }
    if (myMateBefore === null && playedOutcome - balanceNow <= -1 && lostVsBest < 1) {
      return {
        text: pick("positional", [
          `The material stays level but I don't like the resulting position.${bestSan ? ` I'd rather play ${bestSan}.` : ""}`,
          `Nothing is lost on the board, yet the position gets worse.${bestSan ? ` ${bestSan} was healthier.` : ""}`,
        ]),
        motifs: [],
        verified: false,
      };
    }

    const severity = classification === "inaccuracy" ? "a small slip" : classification === "mistake" ? "a clear mistake" : "a serious error";
    return {
      text: bestSan
        ? pick("generic-error", [
            `I'd play ${bestSan} here: it leaves you in a better spot than this move does.`,
            `${capitalise(severity)}: ${bestSan} was stronger.`,
            `Look at ${bestSan}: it keeps things healthier than this move does.`,
            `A more accurate choice was ${bestSan}. This move lets your position slide.`,
          ])
        : pick("generic-error-nobest", [
            `I like the resulting position less than the alternatives.`,
            `${capitalise(severity)}: this makes your position worse.`,
          ]),
      motifs: [],
      verified: false,
    };
  }

  // ---- Good or neutral moves ---------------------------------------------
  if (classification === "brilliant") {
    const sac = balanceNow - playedOutcome;
    return {
      text:
        sac >= 1
          ? pick("brilliant-sac", [
              `A brilliant sacrifice: you give up ${describeMaterial(sac)} for a much stronger position. ${standingSentence(evalAfter, evalBefore, mover, pick)}`.trim(),
              `Spectacular! Giving up ${describeMaterial(sac)} here is the right idea, and it pays off. ${standingSentence(evalAfter, evalBefore, mover, pick)}`.trim(),
              `The kind of move that is easy to miss: ${describeMaterial(sac)} is offered, and the compensation is worth more. ${standingSentence(evalAfter, evalBefore, mover, pick)}`.trim(),
            ])
          : pick("brilliant", [
              "A brilliant move — much stronger than it looks, and it checks out.",
              "Brilliant: a surprising idea that is the best in the position.",
              "Hard to find and exactly right. A truly brilliant move.",
            ]),
      motifs: sac >= 1 ? ["sacrifice"] : [],
      verified: true,
    };
  }

  if (myMateAfter !== null && myMateAfter > 0) {
    const tail = facts?.givesCheck ? ", starting with check" : "";
    return {
      text: pick("mate-threat", [
        `Strong — there is now a forced checkmate in ${myMateAfter}${tail}.`,
        `This sets up a forced mate in ${myMateAfter}${tail}.`,
        `From here it's forced: checkmate in ${myMateAfter}${tail}.`,
      ]),
      motifs: ["mate-threat"],
      verified: true,
    };
  }

  const gained = playedOutcome - balanceNow;
  const described = describeGoodMove(ctx, balanceNow);
  if (gained >= 2 && described) {
    return {
      text: `${described.clause}. ${pick("gain-tail", [`That wins ${describeMaterial(gained)} by force.`, `The line leaves you ${describeMaterial(gained)} up.`, `You come out ${describeMaterial(gained)} ahead.`])}`,
      motifs: described.motifs,
      verified: true,
    };
  }
  if (gained >= 2) {
    return {
      text: pick("wins-material", [
        `This wins ${describeMaterial(gained)} by force.`,
        `Winning ${describeMaterial(gained)} by force is the point of this move.`,
        `The line leaves you ${describeMaterial(gained)} up.`,
      ]),
      motifs: [],
      verified: true,
    };
  }

  // Holding or saving a difficult position.
  const cpBefore = cpFor(evalBefore, mover);
  const cpAfter = cpFor(evalAfter, mover);
  if (cpBefore !== null && cpAfter !== null && cpBefore <= -250 && cpAfter >= -60) {
    return {
      text: pick("defence", [
        "A great defence: in a difficult position this move holds the balance.",
        "Excellent resistance — the position was bad, and this move turns it around.",
        "Saving the game: this move neutralises the opponent's advantage.",
      ]),
      motifs: ["defence"],
      verified: true,
    };
  }

  const standing = standingSentence(evalAfter, evalBefore, mover, pick);
  if (described) {
    const tail = pick("tail-kind", ["class", "class", "stand"]) === "stand" && standing ? standing : classTail(ctx);
    return { text: `${described.clause}. ${tail}`, motifs: described.motifs, verified: true };
  }

  // Nothing special to point at: rating-based wording.
  const afterCp = evalAfter.kind === "cp" ? evalAfter.value : null;
  const equal = afterCp !== null && Math.abs(afterCp) < 50;
  const tail = equal ? pick("equal", [" The position remains approximately equal.", " Things stay balanced.", " Neither side has an edge yet."]) : "";
  switch (classification) {
    case "only":
      return { text: `${pick("only", ["The only good move — the alternatives were clearly worse.", "The only move that keeps the position together.", "Everything else loses ground, so this is the move."])}${tail}`, motifs: [], verified: true };
    case "best":
      return { text: `${pick("best", ["My top choice.", "The best move in the position.", "Exactly what I'd want to see here.", "A precise, best move."])}${tail}`, motifs: [], verified: true };
    case "excellent":
      return {
        text: `${pick("excellent", [
          `Nearly as strong as my top choice${bestSan ? ` (${bestSan})` : ""}.`,
          `An excellent move${bestSan ? `; I'd only prefer ${bestSan} by a hair` : ""}.`,
          "Very accurate — close to the best move.",
        ])}${tail}`,
        motifs: [],
        verified: true,
      };
    default:
      return {
        text: `${pick("good", [
          `A reasonable move; ${bestSan ? `${bestSan} was slightly more precise` : "I'd have found a slightly better option"}.`,
          `A solid choice${bestSan ? `, though ${bestSan} was a bit sharper` : ""}.`,
          `Good, not perfect${bestSan ? ` — ${bestSan} edged it` : ""}.`,
        ])}${tail}`,
        motifs: [],
        verified: true,
      };
  }
}
