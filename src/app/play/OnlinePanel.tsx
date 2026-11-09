"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, LogIn } from "lucide-react";
import { Avatar } from "@/components/account/Avatar";
import { usePlayAs } from "@/components/account/PlayAsDialog";
import { ColorPicker, type ColorChoice, TimeControlPicker } from "@/components/play/tiles";
import { useAccount } from "@/components/providers/AccountProvider";
import { Alert, Button, Card, cx, inputClass } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/api";

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

/**
 * Online play: make a game and send a friend its 6-character code, or type a code to join a friend's game (or watch
 * any game live). The Tempo server referees every game. The first action that needs a player asks, in a dialog,
 * whether to play as a guest (a nickname and a picture) or continue with Google, then carries on.
 */
export function OnlinePanel() {
  const account = useAccount();
  const router = useRouter();
  const { ready, needPlayer, dialog } = usePlayAs("/play?mode=online");
  const [tc, setTc] = useState("5+0");
  const [color, setColor] = useState<ColorChoice>("random");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = () =>
    needPlayer(async () => {
      setBusy(true);
      setError(null);
      try {
        const { code: made } = await api<{ code: string }>("/api/v1/online", { method: "POST", body: { tc, color } });
        router.push(`/play/game?code=${made}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not start a game. Please try again.");
        setBusy(false);
      }
    });

  if (account.status === "loading") return null;
  const me = ready && account.status === "user" ? account.player : null;

  return (
    <div className="space-y-3">
      {dialog}
      {me ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
          <span className="flex items-center gap-2">
            <Avatar name={me.name} image={me.image} size={28} />
            <span>
              Playing as <strong>{me.name}</strong>
              <span className="ml-1.5 font-mono text-xs text-ink-3">#{me.tag}</span>
              {me.guest ? <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-3">Guest</span> : null}
            </span>
          </span>
          {me.guest ? (
            <Link href="/account?next=%2Fplay%3Fmode%3Donline" className="text-xs font-medium text-accent underline-offset-2 hover:underline">
              Sign in to keep your progress
            </Link>
          ) : null}
        </div>
      ) : null}

      <Card className="space-y-4 p-4 sm:p-5">
        <TimeControlPicker value={tc} onChange={setTc} name="online-tc" />
        <ColorPicker value={color} onChange={setColor} name="online-color" />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="size-4 text-accent" aria-hidden /> Play a friend
            </p>
            <p className="text-xs text-ink-3">Get a short code to send them.</p>
            <Button variant="primary" className="mt-auto" loading={busy} disabled={busy} onClick={create}>
              Create a game
            </Button>
          </div>
          {/* Every game has a 6-character code: join it if it is waiting for a player, or watch it live if it has started. */}
          <form
            className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (CODE.test(code)) router.push(`/play/game?code=${code}`);
            }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <LogIn className="size-4 text-accent" aria-hidden /> Join a game
            </p>
            <input
              aria-label="Game code"
              placeholder="Game code, like K7F2QD"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className={cx(inputClass, "font-mono uppercase tracking-[0.2em] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal")}
            />
            <Button type="submit" disabled={!CODE.test(code)}>
              Join
            </Button>
            <p className="text-xs text-ink-3">Or watch any game live with its code.</p>
          </form>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
      </Card>
    </div>
  );
}
