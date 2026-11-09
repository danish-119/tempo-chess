"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Chess } from "chess.js";
import { Check, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Copy, Eye, Flag, Handshake, Search, Share2, Wifi, WifiOff, X } from "lucide-react";
import { Avatar } from "@/components/account/Avatar";
import { usePlayAs } from "@/components/account/PlayAsDialog";
import { Board } from "@/components/board/Board";
import { CapturedPieces } from "@/components/board/CapturedPieces";
import { useAccount } from "@/components/providers/AccountProvider";
import { Alert, Button, ButtonLink, IconButton, cx } from "@/components/ui/primitives";
import { BoardPageSkeleton } from "@/components/ui/Skeleton";
import { copyText } from "@/hooks/useAnnouncer";
import { useSound } from "@/hooks/useSound";
import { ApiError, api } from "@/lib/api";
import { applyUci } from "@/lib/chess/line";
import { parseSingleGame } from "@/lib/chess/pgn";
import { START_FEN } from "@/lib/chess/types";
import { TIME_CONTROLS, formatMs } from "@/lib/clock";
import { type Color, LiveGame, type LivePlayer, type LiveState, describeResult } from "@/lib/online/live";
import { saveGame } from "@/lib/storage/db";

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const opposite = (c: Color): Color => (c === "w" ? "b" : "w");
const tcLabel = (id: string) => TIME_CONTROLS.find((t) => t.id === id)?.label ?? id;

/**
 * Keep a LiveGame for this code, and re-render on every change it reports. A new connection is opened when the
 * viewer changes (signing in, or becoming a guest), because the server learns who you are when you connect.
 */
function useLiveGame(code: string | null, viewer: string | null) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `viewer` is a deliberate dependency: it means reconnect
  const game = useMemo(() => (code ? new LiveGame(code) : null), [code, viewer]);
  useEffect(() => () => game?.close(), [game]);
  const version = useSyncExternalStore(
    (fn) => game?.subscribe(fn) ?? (() => undefined),
    () => (game ? `${game.connection}|${game.state?.moves.length}|${game.state?.status}|${game.state?.drawOffer}|${game.presence.watching}|${game.presence.w}|${game.presence.b}|${game.lastError?.message}|${game.rtt}` : ""),
    () => "",
  );
  void version;
  return game;
}

/** Ticks while a clock is running, so the numbers count down smoothly. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return now;
}

export function GameView() {
  const params = useSearchParams();
  const raw = (params.get("code") ?? "").toUpperCase();
  const code = CODE.test(raw) ? raw : null;
  if (!code) return <JoinByCode />;
  return <LiveGameView key={code} code={code} />;
}

/** No code in the address: ask for one. */
function JoinByCode() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const ok = CODE.test(value);
  return (
    <form
      className="mx-auto max-w-sm space-y-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) router.push(`/play/game?code=${value}`);
      }}
    >
      <h1 className="display text-3xl">Join a game</h1>
      <p className="text-sm text-ink-2">Type a game&apos;s code to join it, or to watch it live.</p>
      <input
        aria-label="Game code"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
        placeholder="K7F2QD"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="h-14 w-full rounded-xl border border-border bg-bg text-center font-mono text-2xl tracking-[0.3em] uppercase placeholder:text-ink-3/50 focus-visible:outline-2"
      />
      <Button type="submit" variant="primary" className="h-11 w-full" disabled={!ok}>
        Join
      </Button>
    </form>
  );
}

function LiveGameView({ code }: { code: string }) {
  // Check the code before opening a live connection, so a mistyped code gets a clear answer.
  const [exists, setExists] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    api(`/api/online/${code}`).then(
      () => alive && setExists(true),
      (err) => alive && setExists(err instanceof ApiError && err.status === 404 ? false : true),
    );
    return () => {
      alive = false;
    };
  }, [code]);
  if (exists === false) {
    return (
      <Alert tone="error" title="There is no game with that code">
        Check the code, or <Link href="/play?mode=online" className="underline">start a new game</Link>.
      </Alert>
    );
  }
  if (exists === null) return <BoardPageSkeleton label="Opening the game…" />;
  return <LiveGameConnected code={code} />;
}

function LiveGameConnected({ code }: { code: string }) {
  const account = useAccount();
  const viewer = account.status === "user" ? account.player.id : null;
  const game = useLiveGame(account.status === "loading" ? null : code, viewer);
  const sound = useSound();
  const s = game?.state ?? null;

  // Sounds for new moves.
  useEffect(() => game?.onMove((san) => sound.playSan(san)), [game, sound]);

  // Once it ends, the game goes into the player's library (for review), once.
  const saved = useRef(false);
  useEffect(() => {
    if (!s || s.status !== "ended" || s.you === "spectator" || saved.current || s.moves.length < 2) return;
    saved.current = true;
    sound.play(s.result?.winner === s.you ? "victory" : s.result?.winner ? "defeat" : "draw");
    try {
      const g = parseSingleGame(pgnOf(s));
      void saveGame({ ...g, id: `online-${s.code}` }, { perspective: s.you }).catch(() => undefined);
    } catch {
      /* the game stays viewable here even if saving fails */
    }
  }, [s, sound]);

  if (!s) return <BoardPageSkeleton label={game?.connection === "reconnecting" ? "Reconnecting…" : "Opening the game…"} />;
  if (s.status === "waiting") return <Waiting game={game!} s={s} />;
  return <Playing game={game!} s={s} />;
}

/** A finished game as PGN, for the library and for review. */
function pgnOf(s: LiveState): string {
  const tags = [
    ["Event", "Tempo online game"],
    ["Site", typeof window === "undefined" ? "Tempo" : `${window.location.origin}/play/game?code=${s.code}`],
    ["White", s.players.w?.name ?? "?"],
    ["Black", s.players.b?.name ?? "?"],
    ["Result", s.result?.result ?? "*"],
  ];
  const body = s.sans.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(" ");
  return `${tags.map(([k, v]) => `[${k} "${v}"]`).join("\n")}\n\n${body} ${s.result?.result ?? "*"}\n`;
}

// ---------------------------------------------------------------- before the game starts

function Waiting({ game, s }: { game: LiveGame; s: LiveState }) {
  const router = useRouter();
  // Joining needs a player: if there is none yet, a dialog offers a guest nickname or Google first.
  const { needPlayer, dialog } = usePlayAs(`/play/game?code=${s.code}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const mine = s.relation === "creator";
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/play/game?code=${s.code}`;

  const copy = async (what: "code" | "link") => {
    if (await copyText(what === "code" ? s.code : url)) {
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    }
  };
  const post = async (action: "join" | "cancel") => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/online/${s.code}/${action}`, { method: "POST" });
      if (action !== "join") router.push("/play?mode=online");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work. Please try again.");
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {dialog}
      <section className="rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow)]">
        <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full bg-bg px-3 py-1 text-xs font-medium text-ink-2">
          <Avatar name={s.creator.name} image={s.creator.image} size={20} /> {s.creator.name}
          {s.creator.tag ? <span className="font-mono text-ink-3">#{s.creator.tag}</span> : null} · {tcLabel(s.tc)}
        </div>
        {mine ? (
          <>
            <h1 className="display text-3xl">Send this code to your friend</h1>
            <button
              type="button"
              onClick={() => void copy("code")}
              aria-label={`Game code ${s.code.split("").join(" ")}. Copy`}
              className="mx-auto mt-5 block rounded-2xl border-2 border-dashed border-accent/60 bg-accent-soft px-6 py-4 font-mono text-4xl font-bold tracking-[0.25em] text-ink transition-transform active:scale-[0.98]"
            >
              {s.code}
            </button>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => void copy("code")}>
                {copied === "code" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied === "code" ? "Copied" : "Copy code"}
              </Button>
              <Button
                onClick={async () => {
                  if (navigator.share) await navigator.share({ title: "Play chess with me on Tempo", text: `Join my game with the code ${s.code}`, url }).catch(() => undefined);
                  else await copy("link");
                }}
              >
                {copied === "link" ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />} {copied === "link" ? "Link copied" : "Share link"}
              </Button>
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-3">
              <span className="inline-block size-2 animate-pulse rounded-full bg-accent" aria-hidden /> Waiting for your friend to join…
            </p>
            <Button variant="ghost" className="mt-2" loading={busy} onClick={() => void post("cancel")}>
              Cancel the game
            </Button>
          </>
        ) : (
          <>
            <h1 className="display text-3xl">Play {s.creator.name}</h1>
            <p className="mt-2 text-sm text-ink-2">{tcLabel(s.tc)}. Colours are drawn when you join.</p>
            <div className="mt-5 grid gap-2">
              <Button variant="primary" className="h-11" loading={busy} onClick={() => needPlayer(() => void post("join"))}>
                Join the game
              </Button>
            </div>
          </>
        )}
        {error ? (
          <Alert tone="error" className="mt-4 text-left">
            {error}
          </Alert>
        ) : null}
        {game.connection === "reconnecting" ? <p className="mt-3 text-xs text-bad">Reconnecting…</p> : null}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- the game

function PlayerStrip({ player, side, s, time, online, active }: { player: LivePlayer | null; side: Color; s: LiveState; time: number | null; online: boolean; active: boolean }) {
  const low = time !== null && time < 20_000;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="relative">
          <Avatar name={player?.name ?? "?"} image={player?.image} size={32} />
          <span className={cx("absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-bg", online ? "bg-good" : "bg-ink-3")} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {player?.name ?? "?"}
            {player?.guest ? <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 align-middle text-[10px] font-medium text-ink-3">Guest</span> : null}
            {player?.tag ? <span className="ml-1.5 align-middle font-mono text-[11px] font-normal text-ink-3">#{player.tag}</span> : null}
            {s.you === side ? <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span> : null}
          </p>
          <CapturedPieces fen={s.fen} side={side} />
        </div>
      </div>
      {time !== null ? (
        <span
          className={cx(
            "rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums transition-colors",
            active ? (low ? "bg-bad text-white" : "bg-ink text-bg") : "bg-surface-2 text-ink-2",
          )}
          role="timer"
          aria-label={`${player?.name ?? side} clock`}
        >
          {formatMs(time)}
        </span>
      ) : null}
    </div>
  );
}

function Playing({ game, s }: { game: LiveGame; s: LiveState }) {
  const router = useRouter();
  const [view, setView] = useState<number | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const live = s.status === "playing";
  const now = useNow(live && !!s.clock);
  const me: Color | null = s.you === "spectator" ? null : s.you;
  const bottom: Color = me ?? "w";
  const top = opposite(bottom);
  const toMove: Color = s.moves.length % 2 === 0 ? "w" : "b";

  const total = s.moves.length;
  const shownPly = view === null || view >= total ? total : Math.max(0, view);
  const viewing = shownPly !== total;
  const { fen, last } = useMemo(() => {
    if (!viewing) {
      const chess = new Chess(START_FEN);
      let lm: { from: string; to: string } | null = null;
      for (const u of s.moves) {
        const m = applyUci(chess, u);
        if (m) lm = { from: m.from, to: m.to };
      }
      return { fen: s.fen, last: lm };
    }
    const chess = new Chess(START_FEN);
    let lm: { from: string; to: string } | null = null;
    for (const u of s.moves.slice(0, shownPly)) {
      const m = applyUci(chess, u);
      if (m) lm = { from: m.from, to: m.to };
    }
    return { fen: chess.fen(), last: lm };
  }, [s.fen, s.moves, shownPly, viewing]);

  const myTurn = live && me === toMove && !viewing;
  const time = (c: Color) => game.timeLeft(c, now);
  const status = s.result
    ? describeResult(s.result, s.you, s.players)
    : s.drawOffer && me && s.drawOffer !== me
      ? `${s.players[s.drawOffer]?.name ?? "Your opponent"} offers a draw.`
      : me
        ? myTurn
          ? "Your move."
          : `Waiting for ${s.players[toMove]?.name ?? "your opponent"}…`
        : `${s.players[toMove]?.name ?? (toMove === "w" ? "White" : "Black")} to move.`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-15rem))]">
        <PlayerStrip player={s.players[top]} side={top} s={s} time={time(top)} online={game.presence[top]} active={live && toMove === top} />
        <Board
          fen={fen}
          orientation={bottom === "w" ? "white" : "black"}
          lastMove={last}
          interactive={myTurn}
          movableColor={me ?? "w"}
          onMove={(uci) => game.move(uci)}
          id="tempo-live"
          ariaLabel="Online game board"
        />
        <PlayerStrip player={s.players[bottom]} side={bottom} s={s} time={time(bottom)} online={game.presence[bottom]} active={live && toMove === bottom} />
        <div className="flex flex-wrap items-center justify-between gap-1" role="group" aria-label="View moves">
          <div className="flex items-center">
            <IconButton label="First move" onClick={() => setView(0)} disabled={shownPly === 0}>
              <ChevronFirst className="size-5" aria-hidden />
            </IconButton>
            <IconButton label="Previous move" onClick={() => setView(shownPly - 1)} disabled={shownPly === 0}>
              <ChevronLeft className="size-5" aria-hidden />
            </IconButton>
            <IconButton label="Next move" onClick={() => setView(shownPly + 1 >= total ? null : shownPly + 1)} disabled={!viewing}>
              <ChevronRight className="size-5" aria-hidden />
            </IconButton>
            <IconButton label="Latest move" onClick={() => setView(null)} disabled={!viewing}>
              <ChevronLast className="size-5" aria-hidden />
            </IconButton>
          </div>
          {viewing ? (
            <Button size="sm" variant="primary" onClick={() => setView(null)}>
              Back to the game{me === toMove && live ? " · your move" : ""}
            </Button>
          ) : null}
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
          <span>
            {tcLabel(s.tc)} · {me ? `you play ${me === "w" ? "White" : "Black"}` : "watching"}
          </span>
          <span className="inline-flex items-center gap-1" aria-label={`${game.presence.watching} watching`}>
            <Eye className="size-3.5" aria-hidden /> {game.presence.watching}
          </span>
        </div>

        <p
          className={cx(
            "rounded-xl border px-3 py-2.5 text-sm font-medium",
            s.result ? "border-accent/40 bg-accent-soft" : myTurn ? "border-good/50 bg-good/10" : "border-border bg-bg",
          )}
          role="status"
          aria-live="polite"
        >
          {status}
        </p>
        {game.lastError && game.lastError.code !== "spectator" ? <Alert tone="warning">{game.lastError.message}</Alert> : null}

        <p className={cx("flex items-center gap-1.5 text-xs", game.connection === "open" ? "text-ink-3" : "font-medium text-bad")}>
          {game.connection === "open" ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
          {game.connection === "open" ? `Connected${game.rtt !== null ? ` · ${Math.round(game.rtt)} ms` : ""}` : "Reconnecting… your clock is safe while we reconnect only if you get back quickly."}
        </p>

        <ol className="max-h-56 space-y-0.5 overflow-y-auto font-mono text-sm" aria-label="Moves">
          {s.sans.length === 0 ? (
            <li className="text-ink-3">No moves yet. {me === "w" ? "You have 30 seconds to make the first move." : ""}</li>
          ) : (
            Array.from({ length: Math.ceil(s.sans.length / 2) }, (_, row) => (
              <li key={row} className="flex items-center gap-1">
                <span className="w-7 text-ink-3">{row + 1}.</span>
                {[row * 2, row * 2 + 1].map((i) =>
                  s.sans[i] ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setView(i + 1 >= total ? null : i + 1)}
                      aria-current={shownPly === i + 1 ? "step" : undefined}
                      className={cx("rounded px-1.5 py-0.5 hover:bg-surface-2", shownPly === i + 1 && "bg-accent-soft font-semibold text-ink")}
                    >
                      {s.sans[i]}
                    </button>
                  ) : null,
                )}
              </li>
            ))
          )}
        </ol>

        {live && me ? (
          <div className="flex flex-wrap gap-2">
            {s.drawOffer && s.drawOffer !== me ? (
              <>
                <Button variant="primary" onClick={() => game.draw("accept")}>
                  <Handshake className="size-4" aria-hidden /> Accept draw
                </Button>
                <Button onClick={() => game.draw("decline")}>
                  <X className="size-4" aria-hidden /> Decline
                </Button>
              </>
            ) : (
              <Button disabled={s.drawOffer === me || s.moves.length < 2} onClick={() => game.draw("offer")}>
                <Handshake className="size-4" aria-hidden /> {s.drawOffer === me ? "Draw offered" : "Offer draw"}
              </Button>
            )}
            {confirmResign ? (
              <>
                <Button variant="danger" onClick={() => game.resign()}>
                  <Flag className="size-4" aria-hidden /> {s.moves.length < 2 ? "Yes, call it off" : "Yes, resign"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmResign(false)}>
                  Keep playing
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirmResign(true)}>
                <Flag className="size-4" aria-hidden /> {s.moves.length < 2 ? "Abort" : "Resign"}
              </Button>
            )}
          </div>
        ) : null}

        {s.status === "ended" ? (
          <div className="flex flex-wrap gap-2">
            {me && s.moves.length >= 2 ? (
              <Button variant="primary" onClick={() => router.push(`/analyze?game=${encodeURIComponent(`online-${s.code}`)}`)}>
                <Search className="size-4" aria-hidden /> Review this game
              </Button>
            ) : null}
            <ButtonLink href="/play?mode=online">New game</ButtonLink>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
