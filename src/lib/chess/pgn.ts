import { Chess, validateFen } from "chess.js";
import { hashString } from "@/lib/utils/hash";
import {
  type GameMetadata,
  type GameResult,
  type GameSource,
  type ImportedGame,
  type PieceSymbol,
  type PlyRecord,
  type TimeClass,
  PgnParseError,
  START_FEN,
} from "./types";

/** Hard limits that protect the main thread from pathological input. */
export const PGN_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxGames: 2000,
  maxPliesPerGame: 1200,
} as const;

const TAG_LINE = /^\s*\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/;
const SUPPORTED_VARIANTS = new Set(["", "standard", "from position", "chess"]);

/**
 * Split a (possibly multi-game) PGN database into individual game texts.
 * A new game starts at the first tag line that follows movetext.
 */
export function splitPgnGames(input: string): string[] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const games: string[] = [];
  let current: string[] = [];
  let seenMovetext = false;

  const flush = () => {
    const body = current.join("\n").trim();
    if (body.length > 0) games.push(body);
    current = [];
    seenMovetext = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const isTag = TAG_LINE.test(trimmed);
    if (isTag && seenMovetext) flush();
    if (!isTag && trimmed.length > 0 && !trimmed.startsWith("%")) seenMovetext = true;
    current.push(line);
  }
  flush();
  return games;
}

export function parseHeaders(gameText: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of gameText.split("\n")) {
    const m = TAG_LINE.exec(line.trim());
    if (m) headers[m[1]] = m[2].replace(/\\(["\\])/g, "$1");
  }
  return headers;
}

const CLOCK_RE = /\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/;
const COMMAND_RE = /\[%[^\]]*\]/g;

export function parseClock(comment: string | undefined): number | undefined {
  if (!comment) return undefined;
  const m = CLOCK_RE.exec(comment);
  if (!m) return undefined;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Remove embedded PGN commands such as [%clk] / [%eval] and tidy whitespace. */
export function cleanComment(comment: string | undefined): string | undefined {
  if (!comment) return undefined;
  const cleaned = comment.replace(COMMAND_RE, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeResult(value: string | undefined): GameResult {
  if (value === "1-0" || value === "0-1" || value === "1/2-1/2") return value;
  return "*";
}

function toInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Classify a PGN TimeControl tag (e.g. "180+2", "1/259200") using estimated
 * game duration = base + 40 × increment, mirroring widely used thresholds.
 */
export function timeClassFromControl(tc: string | undefined): TimeClass | undefined {
  if (!tc || tc === "-" || tc === "?") return undefined;
  if (tc.includes("/")) return "daily";
  const m = /^(\d+)(?:\+(\d+))?$/.exec(tc.trim());
  if (!m) return undefined;
  const estimate = Number(m[1]) + 40 * Number(m[2] ?? 0);
  if (estimate < 180) return "bullet";
  if (estimate < 480) return "blitz";
  if (estimate < 1500) return "rapid";
  return "classical";
}

export function metadataFromHeaders(headers: Record<string, string>): GameMetadata {
  const clean = (v: string | undefined) => (v && v !== "?" && v !== "????.??.??" ? v : undefined);
  return {
    event: clean(headers.Event),
    site: clean(headers.Site),
    date: clean(headers.UTCDate) ?? clean(headers.Date),
    round: clean(headers.Round),
    white: clean(headers.White) ?? "White",
    black: clean(headers.Black) ?? "Black",
    whiteElo: toInt(headers.WhiteElo),
    blackElo: toInt(headers.BlackElo),
    result: normalizeResult(headers.Result),
    timeControl: clean(headers.TimeControl),
    termination: clean(headers.Termination),
    eco: clean(headers.ECO),
    openingName: clean(headers.Opening),
    link: safeLink(headers.Link ?? headers.Site),
    variant: clean(headers.Variant),
    timeClass: timeClassFromControl(headers.TimeControl),
  };
}

/** Only keep http(s) links; anything else (javascript:, data:) is dropped. */
export function safeLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Strip variations "(...)" and NAGs so chess.js only sees the mainline. */
function stripVariations(movetext: string): string {
  let out = "";
  let depth = 0;
  let inComment = false;
  for (const ch of movetext) {
    if (inComment) {
      if (depth === 0) out += ch;
      if (ch === "}") inComment = false;
      continue;
    }
    if (ch === "{") {
      inComment = true;
      if (depth === 0) out += ch;
      continue;
    }
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out;
}

/** Remove semicolon line comments, which chess.js does not support everywhere. */
function stripLineComments(movetext: string): string {
  return movetext
    .split("\n")
    .map((line) => {
      if (line.trim().startsWith("%")) return "";
      let inBrace = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "{") inBrace = true;
        else if (ch === "}") inBrace = false;
        else if (ch === ";" && !inBrace) return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

function splitTagsAndMovetext(gameText: string): { tagText: string; movetext: string } {
  const lines = gameText.split("\n");
  const tags: string[] = [];
  let i = 0;
  while (i < lines.length && (TAG_LINE.test(lines[i].trim()) || lines[i].trim() === "")) {
    if (lines[i].trim() !== "") tags.push(lines[i].trim());
    i++;
  }
  return { tagText: tags.join("\n"), movetext: lines.slice(i).join("\n") };
}

/** Convert one game text into a fully validated ImportedGame. */
export function parseSingleGame(
  gameText: string,
  options: { source?: GameSource; gameIndex?: number; extra?: Partial<GameMetadata> } = {},
): ImportedGame {
  const { source = "pgn", gameIndex, extra } = options;
  const headers = parseHeaders(gameText);
  const variant = (headers.Variant ?? "").trim().toLowerCase();
  if (!SUPPORTED_VARIANTS.has(variant)) {
    throw new PgnParseError(
      "UNSUPPORTED_VARIANT",
      `The variant "${headers.Variant}" is not supported. Only standard chess can be analysed.`,
      gameIndex,
    );
  }

  let startFen = START_FEN;
  if (headers.FEN) {
    const check = validateFen(headers.FEN);
    if (!check.ok) {
      throw new PgnParseError("INVALID_FEN", `The FEN tag is invalid: ${check.error ?? "unknown error"}`, gameIndex);
    }
    startFen = headers.FEN;
  }

  const { tagText, movetext } = splitTagsAndMovetext(gameText);
  const sanitized = `${tagText}\n\n${stripVariations(stripLineComments(movetext)).replace(/\$\d+/g, " ")}`;

  const chess = new Chess();
  try {
    chess.loadPgn(sanitized, { strict: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const illegal = /invalid move|illegal/i.test(detail);
    throw new PgnParseError(
      illegal ? "ILLEGAL_MOVE" : "INVALID_PGN",
      illegal ? `The game contains an illegal or unreadable move. ${detail}` : `Could not read this PGN. ${detail}`,
      gameIndex,
    );
  }

  const history = chess.history({ verbose: true });
  if (history.length > PGN_LIMITS.maxPliesPerGame) {
    throw new PgnParseError("TOO_LARGE", `Games longer than ${PGN_LIMITS.maxPliesPerGame} plies are not supported.`, gameIndex);
  }

  const commentsByFen = new Map<string, string>();
  for (const c of chess.getComments()) commentsByFen.set(c.fen, c.comment);

  const firstFen = history.length > 0 ? history[0].before : chess.fen();
  const moves: PlyRecord[] = history.map((m, idx) => {
    const rawComment = commentsByFen.get(m.after);
    return {
      ply: idx + 1,
      moveNumber: Number(m.before.split(" ")[5]) || 1,
      color: m.color,
      san: m.san,
      uci: `${m.from}${m.to}${m.promotion ?? ""}`,
      from: m.from,
      to: m.to,
      promotion: m.promotion as PieceSymbol | undefined,
      captured: m.captured as PieceSymbol | undefined,
      piece: m.piece as PieceSymbol,
      fenBefore: m.before,
      fenAfter: m.after,
      comment: cleanComment(rawComment),
      clockSeconds: parseClock(rawComment),
    };
  });

  const metadata = { ...metadataFromHeaders(headers), ...extra };
  if (metadata.result === "*") {
    if (chess.isCheckmate()) metadata.result = chess.turn() === "w" ? "0-1" : "1-0";
    else if (chess.isDraw()) metadata.result = "1/2-1/2";
  }

  return {
    id: hashString(`${startFen}|${moves.map((m) => m.uci).join(" ")}|${metadata.white}|${metadata.black}|${metadata.date ?? ""}|${headers.Link ?? headers.Site ?? ""}`),
    source,
    originalPgn: gameText.trim(),
    headers,
    metadata,
    startFen: firstFen,
    moves,
    customStart: firstFen !== START_FEN,
    importedAt: Date.now(),
  };
}

export interface ParseResult {
  games: ImportedGame[];
  errors: PgnParseError[];
}

/**
 * Parse arbitrary PGN text (one or many games). Per-game failures are
 * collected rather than aborting the whole import.
 */
export function parsePgnDatabase(input: string, source: GameSource = "pgn"): ParseResult {
  if (input.trim().length === 0) {
    throw new PgnParseError("EMPTY_INPUT", "Paste or upload a PGN to continue.");
  }
  if (new Blob([input]).size > PGN_LIMITS.maxBytes) {
    throw new PgnParseError("TOO_LARGE", `PGN input is larger than ${PGN_LIMITS.maxBytes / 1024 / 1024} MB.`);
  }
  const texts = splitPgnGames(input);
  if (texts.length > PGN_LIMITS.maxGames) {
    throw new PgnParseError("TOO_MANY_GAMES", `This file has ${texts.length} games; the limit is ${PGN_LIMITS.maxGames}.`);
  }
  const games: ImportedGame[] = [];
  const errors: PgnParseError[] = [];
  texts.forEach((text, index) => {
    try {
      games.push(parseSingleGame(text, { source, gameIndex: index }));
    } catch (err) {
      errors.push(
        err instanceof PgnParseError
          ? err
          : new PgnParseError("INVALID_PGN", err instanceof Error ? err.message : "Unknown parse error", index),
      );
    }
  });
  return { games, errors };
}
