import type { Score } from "./score";

/** A parsed UCI `info` line. Scores are relative to the side to move (raw UCI). */
export interface UciInfo {
  depth?: number;
  seldepth?: number;
  multipv?: number;
  score?: Score;
  /** Present when the score is only a lower/upper bound (aspiration window). */
  bound?: "lower" | "upper";
  nodes?: number;
  nps?: number;
  timeMs?: number;
  hashfull?: number;
  pv?: string[];
  currmove?: string;
  string?: string;
}

export type UciMessage =
  | { type: "uciok" }
  | { type: "readyok" }
  | { type: "id"; name?: string; author?: string }
  | { type: "option"; name: string }
  | { type: "info"; info: UciInfo }
  | { type: "bestmove"; bestmove: string | null; ponder?: string }
  | { type: "unknown"; line: string };

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function isUciMove(token: string): boolean {
  return UCI_MOVE.test(token);
}

const INT_FIELDS = new Set(["depth", "seldepth", "multipv", "nodes", "nps", "time", "hashfull"]);

/** Parse a single `info ...` line. Unknown tokens are ignored, never fatal. */
export function parseInfo(line: string): UciInfo {
  const tokens = line.trim().split(/\s+/);
  const info: UciInfo = {};
  let i = 1; // skip "info"
  while (i < tokens.length) {
    const key = tokens[i];
    if (INT_FIELDS.has(key)) {
      const n = Number.parseInt(tokens[i + 1] ?? "", 10);
      if (Number.isFinite(n)) {
        switch (key) {
          case "depth": info.depth = n; break;
          case "seldepth": info.seldepth = n; break;
          case "multipv": info.multipv = n; break;
          case "nodes": info.nodes = n; break;
          case "nps": info.nps = n; break;
          case "time": info.timeMs = n; break;
          case "hashfull": info.hashfull = n; break;
        }
      }
      i += 2;
      continue;
    }
    if (key === "score") {
      const kind = tokens[i + 1];
      const value = Number.parseInt(tokens[i + 2] ?? "", 10);
      if ((kind === "cp" || kind === "mate") && Number.isFinite(value)) {
        info.score = { kind, value };
      }
      i += 3;
      const next = tokens[i];
      if (next === "lowerbound" || next === "upperbound") {
        info.bound = next === "lowerbound" ? "lower" : "upper";
        i++;
      }
      continue;
    }
    if (key === "currmove") {
      info.currmove = tokens[i + 1];
      i += 2;
      continue;
    }
    if (key === "pv") {
      const pv: string[] = [];
      i++;
      while (i < tokens.length && isUciMove(tokens[i])) pv.push(tokens[i++]);
      info.pv = pv;
      continue;
    }
    if (key === "string") {
      info.string = tokens.slice(i + 1).join(" ");
      break;
    }
    i++;
  }
  return info;
}

export function parseUciLine(raw: string): UciMessage {
  const line = raw.trim();
  if (line === "uciok") return { type: "uciok" };
  if (line === "readyok") return { type: "readyok" };
  if (line.startsWith("info ")) return { type: "info", info: parseInfo(line) };
  if (line.startsWith("bestmove")) {
    const tokens = line.split(/\s+/);
    const move = tokens[1];
    const ponderIdx = tokens.indexOf("ponder");
    return {
      type: "bestmove",
      bestmove: move && isUciMove(move) ? move : null,
      ponder: ponderIdx > 0 ? tokens[ponderIdx + 1] : undefined,
    };
  }
  if (line.startsWith("id ")) {
    const m = /^id\s+(name|author)\s+(.*)$/.exec(line);
    if (m) return m[1] === "name" ? { type: "id", name: m[2] } : { type: "id", author: m[2] };
  }
  if (line.startsWith("option ")) {
    const m = /^option name (.+?) type /.exec(line);
    if (m) return { type: "option", name: m[1] };
  }
  return { type: "unknown", line };
}
