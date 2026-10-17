import type { GameReview, MoveClass } from "@/lib/review/types";
import { MOVE_CLASS_LABEL } from "@/lib/review/types";
import { formatScore } from "@/lib/engine/score";
import type { ImportedGame } from "./types";

/** Standard NAGs: $1 !, $2 ?, $3 !!, $4 ??, $6 ?! */
const NAG: Partial<Record<MoveClass, string>> = {
  brilliant: "$3",
  only: "$1",
  inaccuracy: "$6",
  mistake: "$2",
  blunder: "$4",
  "missed-win": "$2",
};

const SEVEN_TAG_ORDER = ["Event", "Site", "Date", "Round", "White", "Black", "Result"];

function escapeTag(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** PGN comments cannot contain "}" — replace it to keep output parseable. */
function escapeComment(v: string): string {
  return v.replace(/[{}]/g, (c) => (c === "{" ? "(" : ")")).replace(/\s+/g, " ").trim();
}

function headerBlock(game: ImportedGame, extra: Record<string, string> = {}): string {
  const tags: Record<string, string> = { ...game.headers, ...extra };
  for (const t of SEVEN_TAG_ORDER) if (!(t in tags)) tags[t] = t === "Result" ? game.metadata.result : "?";
  tags.Result = game.metadata.result;
  if (game.customStart) {
    tags.SetUp = "1";
    tags.FEN = game.startFen;
  }
  const order = [...SEVEN_TAG_ORDER, ...Object.keys(tags).filter((k) => !SEVEN_TAG_ORDER.includes(k)).sort()];
  return order.map((k) => `[${k} "${escapeTag(tags[k])}"]`).join("\n");
}

function wrap(tokens: string[], width = 80): string {
  const lines: string[] = [];
  let line = "";
  for (const t of tokens) {
    if (line.length > 0 && line.length + 1 + t.length > width) {
      lines.push(line);
      line = t;
    } else {
      line = line ? `${line} ${t}` : t;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/** Re-serialise the mainline (comments/variations from the source are dropped). */
export function exportPgn(game: ImportedGame): string {
  const tokens: string[] = [];
  game.moves.forEach((m, i) => {
    if (m.color === "w") tokens.push(`${m.moveNumber}.`);
    else if (i === 0) tokens.push(`${m.moveNumber}...`);
    tokens.push(m.san);
  });
  tokens.push(game.metadata.result);
  return `${headerBlock(game)}\n\n${wrap(tokens)}\n`;
}

/**
 * Export the game with Tempo's review as PGN comments, NAGs, [%eval] and
 * best-move variations. The original imported PGN is never modified.
 */
export function exportAnnotatedPgn(game: ImportedGame, review: GameReview): string {
  const tokens: string[] = [];
  const extra: Record<string, string> = { Annotator: `Tempo (${review.engineName}, depth ${review.settings.depth})` };
  if (review.white.accuracy !== null) extra.WhiteAccuracy = review.white.accuracy.toFixed(1);
  if (review.black.accuracy !== null) extra.BlackAccuracy = review.black.accuracy.toFixed(1);
  if (review.opening) {
    extra.ECO = review.opening.eco;
    extra.Opening = review.opening.name;
  }
  game.moves.forEach((m, i) => {
    const r = review.moves[i];
    if (m.color === "w") tokens.push(`${m.moveNumber}.`);
    else if (i === 0 || tokens[tokens.length - 1]?.endsWith("}") || tokens[tokens.length - 1]?.endsWith(")")) {
      tokens.push(`${m.moveNumber}...`);
    }
    tokens.push(m.san);
    if (!r) return;
    const nag = NAG[r.classification];
    if (nag) tokens.push(nag);
    const evalTag =
      r.evalAfter.kind === "mate" ? `#${r.evalAfter.value}` : (r.evalAfter.value / 100).toFixed(2);
    const label = MOVE_CLASS_LABEL[r.classification];
    const text = ["book", "best", "forced", "excellent"].includes(r.classification)
      ? label
      : `${label} (${formatScore(r.evalBefore)} → ${formatScore(r.evalAfter)}). ${r.explanation.text}`;
    tokens.push(`{ [%eval ${evalTag}] ${escapeComment(text)} }`);
    const isMistake = ["inaccuracy", "mistake", "blunder", "missed-win"].includes(r.classification);
    if (isMistake && r.bestLineSan.length > 0) {
      const varTokens: string[] = [];
      let moveNo = m.moveNumber;
      let white = m.color === "w";
      r.bestLineSan.slice(0, 6).forEach((san, j) => {
        if (white) varTokens.push(`${moveNo}.`);
        else if (j === 0) varTokens.push(`${moveNo}...`);
        varTokens.push(san);
        if (!white) moveNo++;
        white = !white;
      });
      tokens.push(`(${varTokens.join(" ")})`);
    }
  });
  tokens.push(game.metadata.result);
  return `${headerBlock(game, extra)}\n\n${wrap(tokens)}\n`;
}

export function downloadText(filename: string, text: string, mime = "application/x-chess-pgn"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w.\- ]+/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function gameFileName(game: ImportedGame, suffix = ""): string {
  const base = `${game.metadata.white}_vs_${game.metadata.black}${game.metadata.date ? `_${game.metadata.date}` : ""}`;
  return `${base}${suffix}.pgn`.replace(/[^\w.\-]+/g, "_");
}
