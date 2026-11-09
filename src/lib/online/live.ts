import { API_URL } from "@/lib/api";

/**
 * The app's side of an online game run by the server. The server is the referee; this only keeps a copy of what
 * it says, sends the player's intentions, and stays connected: it reconnects on its own after a dropped
 * connection (the server then sends the whole game again) and measures the round trip so a little network delay
 * can be forgiven on the clock.
 */
export type Color = "w" | "b";

export interface LivePlayer {
  /** Display name or guest nickname; not unique. */
  name: string;
  /** Tempo ID, or null for a guest. */
  tag: string | null;
  image: string | null;
  guest: boolean;
}

export interface GameResult {
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  reason: string;
  winner: Color | null;
}

export interface LiveState {
  code: string;
  you: Color | "spectator";
  /** "creator" when you made this game. */
  relation: "creator" | null;
  status: "waiting" | "playing" | "ended";
  tc: string;
  creator: LivePlayer;
  players: { w: LivePlayer | null; b: LivePlayer | null };
  fen: string;
  moves: string[];
  sans: string[];
  /** Remaining time per side when `clockAt` was measured (ms), or null for an untimed game. */
  clock: { w: number; b: number } | null;
  /** Local time (performance.now()) at which `clock` was correct. */
  clockAt: number;
  drawOffer: Color | null;
  result: GameResult | null;
}

export interface Presence {
  w: boolean;
  b: boolean;
  watching: number;
}

export type Connection = "connecting" | "open" | "reconnecting" | "closed";

type ServerMessage =
  | ({ t: "state"; serverTime: number } & Omit<LiveState, "clockAt">)
  | { t: "move"; uci: string; san: string; ply: number; fen: string; clock: { w: number; b: number } | null; drawOffer: Color | null; serverTime: number }
  | ({ t: "presence" } & Presence)
  | { t: "pong"; n: number; serverTime: number }
  | { t: "error"; code: string; message: string };

const WS_URL = API_URL.replace(/^http/, "ws");
const PING_MS = 4000;

export class LiveGame {
  state: LiveState | null = null;
  presence: Presence = { w: false, b: false, watching: 0 };
  connection: Connection = "connecting";
  /** Round-trip time to the server (ms), once measured. */
  rtt: number | null = null;
  lastError: { code: string; message: string } | null = null;

  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private onMoveListeners = new Set<(san: string, ply: number) => void>();
  private pings = new Map<number, number>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retry = 0;
  private closedByUs = false;
  private n = 0;

  constructor(readonly code: string) {
    this.connect();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Called for each new move (for sounds), not for moves already on the board when connecting. */
  onMove(fn: (san: string, ply: number) => void): () => void {
    this.onMoveListeners.add(fn);
    return () => this.onMoveListeners.delete(fn);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private connect() {
    this.connection = this.retry === 0 ? "connecting" : "reconnecting";
    this.emit();
    const ws = new WebSocket(`${WS_URL}/api/online/${this.code}/ws`);
    this.ws = ws;
    ws.addEventListener("open", () => {
      this.retry = 0;
      this.connection = "open";
      this.emit();
      this.ping();
      this.pingTimer = setInterval(() => this.ping(), PING_MS);
    });
    ws.addEventListener("message", (e) => this.receive(e.data));
    ws.addEventListener("close", () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (this.closedByUs || this.state?.status === "ended") {
        this.connection = "closed";
        this.emit();
        return;
      }
      // Back off: 0.5 s, 1 s, 2 s … up to 10 s.
      const wait = Math.min(10_000, 500 * 2 ** this.retry++);
      this.connection = "reconnecting";
      this.emit();
      setTimeout(() => !this.closedByUs && this.connect(), wait);
    });
  }

  private ping() {
    const n = ++this.n;
    this.pings.set(n, performance.now());
    this.send({ t: "ping", n, lag: this.rtt === null ? undefined : Math.round(this.rtt / 2) });
  }

  private receive(raw: unknown) {
    if (typeof raw !== "string") return;
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    const now = performance.now();
    switch (msg.t) {
      case "state": {
        const { t: _t, serverTime: _s, ...rest } = msg;
        void _t;
        void _s;
        this.state = { ...rest, clockAt: now };
        break;
      }
      case "move": {
        if (!this.state || msg.ply !== this.state.moves.length + 1) return; // a full state follows when out of step
        this.state = {
          ...this.state,
          fen: msg.fen,
          moves: [...this.state.moves, msg.uci],
          sans: [...this.state.sans, msg.san],
          clock: msg.clock,
          clockAt: now,
          drawOffer: msg.drawOffer,
        };
        for (const l of this.onMoveListeners) l(msg.san, msg.ply);
        break;
      }
      case "presence":
        this.presence = { w: msg.w, b: msg.b, watching: msg.watching };
        break;
      case "pong": {
        const sent = this.pings.get(msg.n);
        this.pings.delete(msg.n);
        if (sent !== undefined) this.rtt = this.rtt === null ? now - sent : Math.round(this.rtt * 0.7 + (now - sent) * 0.3);
        break;
      }
      case "error":
        this.lastError = { code: msg.code, message: msg.message };
        break;
    }
    this.emit();
  }

  private send(msg: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /** Time left for `side` right now (ms), counting down for the side to move. */
  timeLeft(side: Color, now = performance.now()): number | null {
    const s = this.state;
    if (!s?.clock) return null;
    const base = s.clock[side];
    const toMove: Color = s.moves.length % 2 === 0 ? "w" : "b";
    if (s.status !== "playing" || side !== toMove || s.moves.length === 0) return base;
    // Before the first animation frame `now` can be older than the last update; never count backwards.
    return Math.max(0, base - Math.max(0, now - s.clockAt));
  }

  move(uci: string): boolean {
    const s = this.state;
    if (!s) return false;
    this.lastError = null;
    return this.send({ t: "move", uci, ply: s.moves.length + 1 });
  }
  resign() {
    this.send({ t: "resign" });
  }
  draw(action: "offer" | "accept" | "decline") {
    this.send({ t: "draw", action });
  }

  close() {
    this.closedByUs = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
  }
}

/** Plain-language ending, from the point of view of `you`. */
export function describeResult(r: GameResult, you: Color | "spectator", players: LiveState["players"]): string {
  const name = (c: Color) => players[c]?.name ?? (c === "w" ? "White" : "Black");
  const how: Record<string, string> = {
    checkmate: "by checkmate",
    resign: "by resignation",
    timeout: "on time",
    stalemate: "by stalemate",
    insufficient: "by insufficient material",
    "timeout-insufficient": "on time, but the other side could not checkmate",
    threefold: "by threefold repetition",
    "fifty-moves": "by the fifty-move rule",
    agreement: "by agreement",
  };
  if (r.result === "*") {
    if (r.reason === "expired") return "Nobody joined in time, so the game was called off.";
    return "The game was called off before it started.";
  }
  if (!r.winner) return `Draw ${how[r.reason] ?? ""}.`.replace(" .", ".");
  if (you === r.winner) return `You won ${how[r.reason] ?? ""}.`.replace(" .", ".");
  if (you !== "spectator") return `You lost ${how[r.reason] ?? ""}.`.replace(" .", ".");
  return `${name(r.winner)} won ${how[r.reason] ?? ""}.`.replace(" .", ".");
}
