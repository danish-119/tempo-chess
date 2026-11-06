"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Flag, Handshake, Link2, RotateCcw, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { Board } from "@/components/board/Board";
import { KingIcon, TC_COLOR, TC_ICON } from "@/components/play/tiles";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Alert, Button, Card, SectionTitle, Spinner, Toggle, cx } from "@/components/ui/primitives";
import { copyText } from "@/hooks/useAnnouncer";
import { record } from "@/hooks/useProgress";
import { useSound } from "@/hooks/useSound";
import { isThreefoldRepetition } from "@/lib/chess/repetition";
import { START_FEN } from "@/lib/chess/types";
import { type ClockState, TIME_CONTROLS, formatMs, timeLeft } from "@/lib/clock";
import { afterLocalMove, afterRemoteMove, startOnlineClock, stopClock, timeoutVerdict } from "@/lib/online/clock";
import { type IceMode, Peer } from "@/lib/online/peer";
import { type Message, applyRemoteMove, parseMessage } from "@/lib/online/protocol";
import { extractCode } from "@/lib/online/signal";
import { dateKey, recordActivity } from "@/lib/progress";

type Color = "w" | "b";
type Role = "host" | "guest";
type Stage = "menu" | "hosting" | "joining" | "playing" | "closed";

interface GameState {
  color: Color;
  game: number;
  moves: string[];
  sans: string[];
  fen: string;
  last: { from: string; to: string } | null;
  over: string | null;
  drawFrom: "me" | "them" | null;
  rematchFrom: "me" | "them" | null;
  notice: string | null;
  tcId: string;
  clock: ClockState | null;
}

const opposite = (c: Color): Color => (c === "w" ? "b" : "w");
const tcOf = (id: string) => TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[0];

const newGame = (color: Color, game: number, tcId: string): GameState => ({
  color,
  game,
  moves: [],
  sans: [],
  fen: START_FEN,
  last: null,
  over: null,
  drawFrom: null,
  rematchFrom: null,
  notice: null,
  tcId,
  clock: startOnlineClock(tcOf(tcId), performance.now()),
});

/** `moves` is the whole game in UCI: a position rebuilt from a FEN has no history, so repetition needs the list. */
function outcome(chess: Chess, mover: Color, me: Color, moves: readonly string[]): string | null {
  if (chess.isCheckmate()) return mover === me ? "Checkmate. You win!" : "Checkmate. You lose.";
  if (chess.isStalemate()) return "Stalemate. It is a draw.";
  if (isThreefoldRepetition(moves)) return "Draw by threefold repetition.";
  if (chess.isDraw()) return "The game is drawn.";
  return null;
}

const STEPS = ["Create the invite", "Friend replies", "Play"] as const;

/** Three-step progress strip shown while connecting. */
function Steps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? "step" : undefined}
          className={cx(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
            i === current ? "border-accent bg-accent-soft font-semibold" : i < current ? "border-border text-ink-2" : "border-border text-ink-3",
          )}
        >
          <span
            className={cx(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular",
              i < current ? "bg-good text-bg" : i === current ? "bg-accent text-accent-ink" : "bg-surface-2",
            )}
            aria-hidden
          >
            {i < current ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className="truncate">{label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Peer-to-peer game with a friend: an invite link, a reply code, then moves go directly between browsers. */
export function OnlineGame({ onActiveChange }: { onActiveChange?: (active: boolean) => void } = {}) {
  const sound = useSound();
  const { settings } = useSettings();
  const [stage, setStage] = useState<Stage>("menu");
  const [iceMode, setIceMode] = useState<IceMode>("internet");
  const [hostColor, setHostColor] = useState<Color | "random">("random");
  const [hostTc, setHostTc] = useState("10+0");
  const [inviteLink, setInviteLink] = useState("");
  const [replyCode, setReplyCode] = useState("");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "reply" | null>(null);
  const [closedReason, setClosedReason] = useState("");
  const [g, setGState] = useState<GameState | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [stalled, setStalled] = useState(false);
  const [now, setNow] = useState(0);
  /** null until the browser has checked; avoids flashing a wrong state from the prerendered page. */
  const [supported, setSupported] = useState<boolean | null>(null);

  const gRef = useRef<GameState | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const roleRef = useRef<Role>("host");
  const hostColorRef = useRef<Color>("w");
  const hostTcRef = useRef("10+0");
  const hashHandled = useRef(false);
  const pingSent = useRef(new Map<number, number>());
  const lastHeard = useRef(0);

  const setG = useCallback((next: GameState | null) => {
    gRef.current = next;
    setGState(next);
  }, []);

  const send = useCallback((msg: Message) => peerRef.current?.send(msg) ?? false, []);

  const startGame = useCallback(
    (color: Color, game: number, tcId: string) => {
      setG(newGame(color, game, tcId));
      setStage("playing");
      sound.play("game-end");
    },
    [setG, sound],
  );

  /** Host begins game number `game`, playing `hostSide`. */
  const hostStarts = useCallback(
    (hostSide: Color, game: number) => {
      hostColorRef.current = hostSide;
      send({ t: "start", guestColor: opposite(hostSide), game, tc: hostTcRef.current });
      startGame(hostSide, game, hostTcRef.current);
    },
    [send, startGame],
  );

  const finishGame = useCallback(
    (over: string) => {
      const cur = gRef.current;
      if (!cur || cur.over) return;
      setG({ ...cur, over, drawFrom: null, clock: stopClock(cur.clock, performance.now()) });
      sound.play(over.includes("win") ? "victory" : over.includes("lose") ? "defeat" : "draw");
      record((p) => recordActivity(p, dateKey()));
    },
    [setG, sound],
  );

  const handlers = useCallback(
    () => ({
      onOpen: () => {
        if (roleRef.current === "host") hostStarts(hostColorRef.current, 1);
      },
      onMessage: (raw: unknown) => {
        const msg = parseMessage(raw);
        if (!msg) return;
        lastHeard.current = performance.now();
        const cur = gRef.current;
        switch (msg.t) {
          case "ping":
            send({ t: "pong", n: msg.n });
            break;
          case "pong": {
            const sentAt = pingSent.current.get(msg.n);
            if (sentAt !== undefined) {
              pingSent.current.delete(msg.n);
              setLatency(Math.round(performance.now() - sentAt));
              setStalled(false);
            }
            break;
          }
          case "start":
            if (roleRef.current === "guest") startGame(msg.guestColor, msg.game, TIME_CONTROLS.some((t) => t.id === msg.tc) ? msg.tc : "none");
            break;
          case "move": {
            if (!cur || cur.over) break;
            const res = applyRemoteMove(cur.fen, opposite(cur.color), cur.moves.length, msg);
            if (!res.ok) {
              setG({ ...cur, notice: res.reason });
              break;
            }
            sound.playSan(res.san);
            const clock = cur.clock ? afterRemoteMove(cur.clock, cur.color, tcOf(cur.tcId), msg.ms, performance.now()) : null;
            setG({
              ...cur,
              clock,
              moves: [...cur.moves, msg.uci],
              sans: [...cur.sans, res.san],
              fen: res.fen,
              last: { from: res.from, to: res.to },
              drawFrom: null,
              notice: null,
            });
            const over = outcome(new Chess(res.fen), opposite(cur.color), cur.color, [...cur.moves, msg.uci]);
            if (over) finishGame(over);
            break;
          }
          case "flag":
            finishGame("Your opponent ran out of time. You win!");
            break;
          case "resign":
            finishGame("Your opponent resigned. You win!");
            break;
          case "draw":
            if (!cur || cur.over) break;
            if (msg.action === "offer") setG({ ...cur, drawFrom: "them", notice: "Your opponent offers a draw." });
            else if (msg.action === "accept" && cur.drawFrom === "me") finishGame("Draw agreed.");
            else if (msg.action === "decline") setG({ ...cur, drawFrom: null, notice: "Draw declined." });
            break;
          case "rematch":
            if (!cur?.over) break;
            if (roleRef.current === "host" && (msg.action === "accept" || cur.rematchFrom === "me")) {
              hostStarts(opposite(hostColorRef.current), cur.game + 1);
            } else if (msg.action === "offer") {
              setG({ ...cur, rematchFrom: "them" });
            }
            break;
        }
      },
      onClose: (reason: string) => {
        setClosedReason(reason);
        setStage((s) => (s === "playing" && gRef.current?.over ? s : "closed"));
      },
    }),
    [finishGame, hostStarts, send, setG, sound, startGame],
  );

  const reset = () => {
    peerRef.current?.close();
    peerRef.current = null;
    setG(null);
    setInviteLink("");
    setReplyCode("");
    setPasted("");
    setError(null);
    setStage("menu");
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  };

  const createInvite = async () => {
    setBusy(true);
    setError(null);
    try {
      roleRef.current = "host";
      hostColorRef.current = hostColor === "random" ? (Math.random() < 0.5 ? "w" : "b") : hostColor;
      hostTcRef.current = hostTc;
      const { peer, code } = await Peer.host(handlers(), iceMode);
      peerRef.current = peer;
      setInviteLink(`${window.location.origin}/play#o=${code}`);
      setStage("hosting");
    } catch {
      setError("Could not create the invite. Your browser may block peer-to-peer connections.");
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    const peer = peerRef.current;
    if (!peer) return;
    setBusy(true);
    setError(null);
    const ok = await peer.acceptAnswer(extractCode(pasted));
    if (!ok) setError("That reply code isn't valid. Ask your friend to copy it again, in full.");
    setBusy(false);
  };

  const joinWith = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      roleRef.current = "guest";
      setStage("joining");
      try {
        const res = await Peer.join(code, handlers(), iceMode);
        if (!res) {
          setError("This invite link isn't valid or has expired. Ask your friend for a new one.");
          setStage("menu");
        } else {
          peerRef.current = res.peer;
          setReplyCode(res.code);
        }
      } catch {
        setError("Could not join. Your browser may block peer-to-peer connections.");
        setStage("menu");
      } finally {
        setBusy(false);
      }
    },
    [handlers, iceMode],
  );

  // Check WebRTC support in the browser (the static page is built on a server without it, so
  // nothing must be decided at render time), then answer an invite link (#o=…) straight away.
  useEffect(() => {
    if (hashHandled.current) return;
    hashHandled.current = true;
    const ok = Peer.supported();
    setSupported(ok);
    // The early script in the layout hides the Play setup while an invite link loads; we are in charge now.
    document.documentElement.removeAttribute("data-join");
    if (!ok) return;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("o");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (code) void joinWith(code);
  }, [joinWith]);

  // Tell the Play screen when a connection or game is under way, so it can hide the mode cards.
  useEffect(() => {
    onActiveChange?.(stage !== "menu");
  }, [stage, onActiveChange]);
  useEffect(() => () => onActiveChange?.(false), [onActiveChange]);

  useEffect(() => () => peerRef.current?.close(), []);

  // Heartbeat while a game is open: shows the round-trip time and flags a stalled link.
  useEffect(() => {
    if (stage !== "playing") return;
    lastHeard.current = performance.now();
    let n = 0;
    const id = setInterval(() => {
      n = (n + 1) % 1_000_000_000;
      pingSent.current.set(n, performance.now());
      if (pingSent.current.size > 20) pingSent.current.delete(pingSent.current.keys().next().value as number);
      send({ t: "ping", n });
      setStalled(performance.now() - lastHeard.current > 7000);
    }, 2000);
    return () => clearInterval(id);
  }, [stage, send]);

  // Clock display tick, and the flag when a clock reaches zero.
  const clockRunning = g?.clock?.running ?? null;
  const gameOver = g?.over ?? null;
  useEffect(() => {
    if (stage !== "playing" || !clockRunning || gameOver) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [stage, clockRunning, gameOver]);

  useEffect(() => {
    const cur = gRef.current;
    if (!cur || cur.over) return;
    const verdict = timeoutVerdict(cur.clock, cur.color, now);
    if (!verdict) return;
    if (verdict.mine) {
      send({ t: "flag" });
      finishGame("You ran out of time. You lose.");
    } else {
      finishGame("Your opponent ran out of time. You win!");
    }
  }, [now, send, finishGame]);

  const copy = async (what: "link" | "reply", text: string) => {
    if (await copyText(text)) {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const myTurn = !!g && !g.over && new Chess(g.fen).turn() === g.color;

  const onMove = (uci: string): boolean => {
    const cur = gRef.current;
    if (!cur || cur.over) return false;
    const chess = new Chess(cur.fen);
    if (chess.turn() !== cur.color) return false;
    let m;
    try {
      m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      return false;
    }
    let clock = cur.clock;
    let ms: number | undefined;
    if (clock) {
      if (timeLeft(clock, cur.color, performance.now()) <= 0) return false; // the flag is about to fall
      const after = afterLocalMove(clock, cur.color, tcOf(cur.tcId), performance.now());
      clock = after.clock;
      ms = after.ms;
    }
    if (!send({ t: "move", uci, ply: cur.moves.length + 1, ms })) {
      setG({ ...cur, notice: "Not connected. Your move was not sent." });
      return false;
    }
    sound.playSan(m.san);
    setG({ ...cur, clock, moves: [...cur.moves, uci], sans: [...cur.sans, m.san], fen: chess.fen(), last: { from: m.from, to: m.to }, drawFrom: null, notice: null });
    const over = outcome(chess, cur.color, cur.color, [...cur.moves, uci]);
    if (over) finishGame(over);
    return true;
  };

  if (supported === null) {
    // Same shape as the real page, so nothing jumps when it appears.
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <div className="h-28 animate-pulse rounded-xl border border-border bg-surface" aria-hidden />
        <div className="h-96 animate-pulse rounded-xl border border-border bg-surface" aria-hidden />
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert tone="error" title="Peer-to-peer isn't available">
          This browser does not support WebRTC, which online play needs. Try a recent Chrome, Edge, Firefox or Safari.
        </Alert>
      </div>
    );
  }

  /** Name, colour and clock for one side, shown above and below the board. */
  const strip = (side: Color, name: string) => {
    const clock = g?.clock;
    const toMove = !!g && !g.over && new Chess(g.fen).turn() === side;
    const left = clock ? timeLeft(clock, side, Math.max(now, clock.since)) : null;
    return (
      <div className="flex items-center justify-between gap-2 px-1 py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-block size-3.5 shrink-0 rounded-sm border border-border" style={{ background: side === "w" ? "var(--eval-white)" : "var(--eval-black)" }} aria-hidden />
          <span className="truncate text-sm font-semibold">{name}</span>
          {toMove ? <span className="rounded bg-accent-soft px-1.5 text-[11px] font-medium text-accent">to move</span> : null}
        </span>
        {left !== null ? (
          <span
            role="timer"
            aria-label={`${name === "You" ? "Your" : "Friend's"} clock`}
            className={cx(
              "rounded-md px-2.5 py-0.5 font-mono text-base tabular",
              clock?.running === side ? "bg-ink text-bg" : "bg-surface-2 text-ink-2",
              left < 20_000 && "text-bad",
            )}
          >
            {formatMs(left)}
          </span>
        ) : null}
      </div>
    );
  };

  // ---- playing -----------------------------------------------------------------
  if (stage === "playing" && g) {
    const lines: string[] = [];
    for (let i = 0; i < g.sans.length; i += 2) lines.push(`${i / 2 + 1}. ${g.sans[i]}${g.sans[i + 1] ? ` ${g.sans[i + 1]}` : ""}`);
    const tc = tcOf(g.tcId);
    return (
      <>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-14rem))]">
            {strip(opposite(g.color), "Your friend")}
            <Board
              fen={g.fen}
              orientation={g.color === "w" ? "white" : "black"}
              lastMove={g.last}
              interactive={myTurn}
              movableColor={g.color}
              onMove={onMove}
              id="tempo-online"
              ariaLabel="Online game board"
            />
            {strip(g.color, "You")}
          </div>
          <Card className="h-fit space-y-4 p-4">
            <div>
              <SectionTitle>
                You play {g.color === "w" ? "White" : "Black"} · {tc.baseMs === null ? "No clock" : tc.label}
              </SectionTitle>
              <p className="mt-1 text-sm font-medium" role="status" aria-live="polite">
                {g.over ?? (myTurn ? "Your move" : "Waiting for your opponent…")}
              </p>
            </div>
            <p className={cx("flex items-center gap-1.5 text-xs", stalled || (latency ?? 0) > 400 ? "font-medium text-bad" : "text-ink-3")} role="status">
              {stalled ? <WifiOff className="size-3.5" aria-hidden /> : <Wifi className="size-3.5" aria-hidden />}
              {stalled ? "Connection unstable: waiting for your opponent…" : latency === null ? "Connected" : latency > 400 ? `Slow connection · ${latency} ms` : `Connected · ${latency} ms`}
            </p>
            {g.notice ? <Alert tone="info">{g.notice}</Alert> : null}
            <ol className="max-h-48 overflow-y-auto font-mono text-sm" aria-label="Moves">
              {lines.length === 0 ? <li className="text-ink-3">No moves yet.</li> : lines.map((l) => <li key={l}>{l}</li>)}
            </ol>
            {!g.over ? (
              <div className="flex flex-wrap gap-2">
                {g.drawFrom === "them" ? (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => {
                        send({ t: "draw", action: "accept" });
                        finishGame("Draw agreed.");
                      }}
                    >
                      Accept draw
                    </Button>
                    <Button
                      onClick={() => {
                        send({ t: "draw", action: "decline" });
                        setG({ ...g, drawFrom: null, notice: null });
                      }}
                    >
                      Decline
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={g.drawFrom === "me" || g.moves.length < 2}
                    onClick={() => {
                      send({ t: "draw", action: "offer" });
                      setG({ ...g, drawFrom: "me", notice: "Draw offered." });
                    }}
                  >
                    <Handshake className="mr-1.5 size-4" aria-hidden /> Offer draw
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    send({ t: "resign" });
                    finishGame("You resigned.");
                  }}
                >
                  <Flag className="mr-1.5 size-4" aria-hidden /> Resign
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {g.rematchFrom === "them" ? (
                  <Button
                    variant="primary"
                    onClick={() => {
                      send({ t: "rematch", action: "accept" });
                      if (roleRef.current === "host") hostStarts(opposite(hostColorRef.current), g.game + 1);
                    }}
                  >
                    <RotateCcw className="mr-1.5 size-4" aria-hidden /> Accept rematch
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={g.rematchFrom === "me"}
                    onClick={() => {
                      send({ t: "rematch", action: "offer" });
                      setG({ ...g, rematchFrom: "me" });
                    }}
                  >
                    <RotateCcw className="mr-1.5 size-4" aria-hidden /> {g.rematchFrom === "me" ? "Rematch offered…" : "Rematch (swap colours)"}
                  </Button>
                )}
                <Button variant="ghost" onClick={reset}>
                  Leave
                </Button>
              </div>
            )}
          </Card>
        </div>
      </>
    );
  }

  // ---- connection ended ------------------------------------------------------------
  if (stage === "closed") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert tone="warning" title="Connection ended" action={<Button variant="primary" onClick={reset}>Start over</Button>}>
          {closedReason || "The connection closed."}
        </Alert>
      </div>
    );
  }

  // ---- host: share the link, then paste the reply -----------------------------------
  if (stage === "hosting") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Steps current={1} />
        <Card className="space-y-3 p-5">
          <SectionTitle>1 · Send this link to your friend</SectionTitle>
          <div className="flex gap-2">
            <input readOnly value={inviteLink} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 font-mono text-xs text-ink" />
            <Button onClick={() => copy("link", inviteLink)}>
              {copied === "link" ? <Check className="mr-1.5 size-4" aria-hidden /> : <Copy className="mr-1.5 size-4" aria-hidden />}
              {copied === "link" ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-ink-3">The link works for one game. Keep this page open until your friend replies.</p>
        </Card>
        <Card className="space-y-3 p-5">
          <SectionTitle>2 · Paste your friend&apos;s reply code</SectionTitle>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            aria-label="Reply code from your friend"
            placeholder="d.…"
            className="h-24 w-full rounded-lg border border-border bg-surface p-2 font-mono text-xs text-ink"
          />
          <div className="flex items-center gap-3">
            <Button variant="primary" size="lg" onClick={connect} disabled={busy || !pasted.trim()}>
              <Wifi className="mr-1.5 size-4" aria-hidden /> Connect
            </Button>
            {busy ? <Spinner label="Connecting…" /> : null}
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
        </Card>
        <Button variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    );
  }

  // ---- guest: send the reply code back ----------------------------------------------
  if (stage === "joining") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Steps current={1} />
        <Card className="space-y-3 p-5">
          <SectionTitle>Send this reply code back to your friend</SectionTitle>
          {replyCode ? (
            <>
              <textarea readOnly value={replyCode} aria-label="Your reply code" onFocus={(e) => e.currentTarget.select()} className="h-24 w-full rounded-lg border border-border bg-surface p-2 font-mono text-xs text-ink" />
              <Button onClick={() => copy("reply", replyCode)}>
                {copied === "reply" ? <Check className="mr-1.5 size-4" aria-hidden /> : <Copy className="mr-1.5 size-4" aria-hidden />}
                {copied === "reply" ? "Copied" : "Copy reply code"}
              </Button>
              <p className="text-sm text-ink-2" role="status">
                <Spinner label="Waiting for your friend to connect…" />
              </p>
            </>
          ) : (
            <Spinner label="Preparing your reply…" />
          )}
          {error ? <Alert tone="error">{error}</Alert> : null}
        </Card>
        <Button variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    );
  }

  // ---- menu ----------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl space-y-4">

      <Card className="space-y-4 p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Play as</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["w", "random", "b"] as const).map((c) => (
              <label
                key={c}
                className={cx(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)]",
                  hostColor === c ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
                )}
              >
                <input type="radio" name="color" className="sr-only" checked={hostColor === c} onChange={() => setHostColor(c)} />
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
                    hostTc === t.id ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
                  )}
                >
                  <input type="radio" name="tc" className="sr-only" checked={hostTc === t.id} onChange={() => setHostTc(t.id)} />
                  <Icon className="size-5" style={{ color: TC_COLOR[t.kind] }} aria-hidden />
                  <span className="text-xs font-semibold">{t.label}</span>
                  <span className="text-[10px] capitalize text-ink-3">{t.kind === "none" ? "untimed" : t.kind}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-xl border border-border p-3">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="size-4 text-accent" aria-hidden /> Connection
          </p>
          <Toggle
            label="Use public STUN servers (recommended)"
            description="Lets two players on different networks find each other. It reveals your IP address to Google and Cloudflare's STUN service, the way any video call does. Turn off to play only on the same Wi-Fi."
            checked={iceMode === "internet"}
            onChange={(v) => setIceMode(v ? "internet" : "lan")}
          />
        </div>

        <Button variant="primary" size="lg" className="w-full" onClick={createInvite} loading={busy}>
          <Link2 className="mr-1.5 size-5" aria-hidden /> Create invite link
        </Button>
        {error ? <Alert tone="error">{error}</Alert> : null}
      </Card>

      <Card className="space-y-2 p-5">
        <SectionTitle>Got a link?</SectionTitle>
        <p className="text-sm text-ink-2">Open it in your browser and Tempo does the rest, or paste it here:</p>
        <div className="flex gap-2">
          <input
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            aria-label="Invite link from your friend"
            placeholder="https://…/play#o=…"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 font-mono text-xs text-ink"
          />
          <Button variant="primary" disabled={!pasted.trim() || busy} onClick={() => void joinWith(extractCode(pasted))}>
            Join
          </Button>
        </div>
      </Card>
    </div>
  );
}
