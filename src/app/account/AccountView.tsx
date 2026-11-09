"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Copy, LogOut, Pencil } from "lucide-react";
import { Avatar } from "@/components/account/Avatar";
import { AvatarPicker, useNewPicture } from "@/components/account/AvatarPicker";
import { GoogleButton } from "@/components/account/GoogleButton";
import { GuestSetup } from "@/components/account/GuestSetup";
import { refreshPlayer, useAccount } from "@/components/providers/AccountProvider";
import { Alert, Button, Field, cx, inputClass } from "@/components/ui/primitives";
import { AccountSkeleton } from "@/components/ui/Skeleton";
import { copyText } from "@/hooks/useAnnouncer";
import { appUrl, authClient } from "@/lib/account/auth-client";
import { flushDocs } from "@/lib/account/docs";
import { guestPictureUrl } from "@/lib/account/guest";
import type { Player } from "@/lib/account/session";

const NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.'-]{1,23}$/u;

/** `?next=/play/game?code=…` brings the player back after signing in; only paths on this site are accepted. */
function nextPath(raw: string | null): string | null {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

export function AccountView() {
  const account = useAccount();
  const params = useSearchParams();
  const router = useRouter();
  const next = nextPath(params.get("next"));
  const signedIn = account.status === "user" && !account.player.guest;

  // Signed in and asked to go somewhere: go there.
  useEffect(() => {
    if (signedIn && next) router.replace(next);
  }, [signedIn, next, router]);

  if (account.status === "loading") return <AccountSkeleton />;
  if (account.status === "user") return account.player.guest ? <GuestProfile player={account.player} next={next} /> : <Profile player={account.player} />;
  return <SignIn next={next} error={params.get("error")} />;
}

// ---------------------------------------------------------------- signed out

function SignIn({ next, error }: { next: string | null; error: string | null }) {
  const back = next ? `/account?next=${encodeURIComponent(next)}` : "/account";
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)] sm:p-7">
      {error ? (
        <Alert tone="error" className="mb-4">
          Signing in with Google did not work. Please try again.
        </Alert>
      ) : null}
      <h1 className="display text-3xl">Sign in to Tempo</h1>
      <p className="mt-1.5 text-sm text-ink-2">Your games, reviews, progress and settings are saved to your account and follow you to every device.</p>
      <ul className="mt-4 space-y-1.5 text-sm text-ink-2">
        {["Your own Tempo ID, the same on every device", "Every online game kept for review", "Free, with no password to remember"].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> {t}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <GoogleButton callback={appUrl(back)} />
      </div>
      <p className="mt-4 text-xs text-ink-3">
        By signing in you agree to the <Link href="/terms" className="underline">terms</Link> and the <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- signed in

/** A Google account's name and picture: rename, and optionally swap the Google photo for a DiceBear picture. */
function ProfileEditor({ player, onDone }: { player: Player; onDone: () => void }) {
  const [name, setName] = useState(player.name);
  const [newPicture, setNewPicture] = useState(false);
  const [picture, setPicture, options, shuffle] = useNewPicture();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tidy = name.replace(/\s+/g, " ").trim();
  const valid = NAME.test(tidy);

  return (
    <form
      className="mt-5 space-y-3 border-t border-border pt-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        setError(null);
        const { error: err } = await authClient.updateUser({ name: tidy, ...(newPicture ? { image: guestPictureUrl(picture.style, picture.seed) } : {}) });
        if (err) {
          setBusy(false);
          return setError(err.message || "Could not save. Please try again.");
        }
        await refreshPlayer();
        setBusy(false);
        onDone();
      }}
    >
      <Field label="Your name" error={tidy && !valid ? "2 to 24 letters, numbers or spaces." : null}>
        {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className={cx(inputClass, "h-10")} />}
      </Field>
      {newPicture ? (
        <AvatarPicker picture={picture} onChange={setPicture} options={options} onShuffle={shuffle} />
      ) : (
        <button type="button" onClick={() => setNewPicture(true)} className="text-sm font-medium text-accent underline-offset-2 hover:underline">
          Choose a new picture
        </button>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={busy} disabled={!valid}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TempoId({ tag }: { tag: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
      <div>
        <h2 className="font-semibold">Your Tempo ID</h2>
        <p className="mt-1 text-sm text-ink-2">It tells you apart from players with the same name. It is yours and never changes.</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          if (await copyText(`#${tag}`)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        aria-label={`Your Tempo ID is ${tag.split("").join(" ")}. Copy`}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-accent/60 bg-accent-soft px-4 py-2 font-mono text-xl font-bold tracking-[0.15em] text-ink transition-transform active:scale-[0.98]"
      >
        #{tag}
        {copied ? <Check className="size-4 text-accent" aria-hidden /> : <Copy className="size-4 text-ink-3" aria-hidden />}
      </button>
    </section>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const params = useSearchParams();
  // Back from signing in again to confirm it is really them.
  const [confirm, setConfirm] = useState(params.get("delete") === "1");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Delete your account</h2>
      <p className="mt-1 text-sm text-ink-2">This deletes your account and everything saved in it: games, reviews, progress and settings. It cannot be undone.</p>
      {stale ? (
        <div className="mt-3 max-w-sm space-y-2">
          <p className="text-sm text-ink-2">For your safety, sign in with Google once more, then delete.</p>
          <GoogleButton callback={appUrl("/account?delete=1")} label="Sign in again with Google" />
        </div>
      ) : confirm ? (
        <div className="mt-3 space-y-3">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex gap-2">
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const { error: err } = await authClient.deleteUser({});
                setBusy(false);
                // Deleting needs a sign-in from the last day.
                if (err?.status === 400 || err?.status === 401) return setStale(true);
                if (err) return setError("Could not delete your account. Please try again.");
                router.replace("/");
              }}
            >
              Delete my account
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="mt-3 text-bad" onClick={() => setConfirm(true)}>
          Delete my account…
        </Button>
      )}
    </section>
  );
}

/** A guest: everything works, but it lives on this browser only. Signing in with Google keeps it for good. */
function GuestProfile({ player, next }: { player: Player; next: string | null }) {
  const [editing, setEditing] = useState(false);
  const back = next ? `/account?next=${encodeURIComponent(next)}` : "/account";
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)]">
        <div className="flex items-center gap-4">
          <Avatar name={player.name} image={player.image} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="display truncate text-3xl">{player.name}</h1>
            <p className="text-sm text-ink-3">Guest</p>
          </div>
          {editing ? null : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> Change name and picture
            </Button>
          )}
        </div>
        {editing ? (
          <div className="mt-5 border-t border-border pt-5">
            <GuestSetup next="/account" edit onDone={() => setEditing(false)} />
            <Button variant="ghost" className="mt-2" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : null}
      </section>
      <section className="rounded-2xl border border-accent/50 bg-accent-soft p-5">
        <h2 className="font-semibold">Keep your progress for good</h2>
        <p className="mt-1 text-sm text-ink-2">
          As a guest, your lessons, games and settings are saved on this browser while you come back at least once a month. Clearing the browser&apos;s data
          starts you over. Sign in with Google to keep everything, your Tempo ID included, on every device.
        </p>
        <div className="mt-4 max-w-sm">
          <GoogleButton callback={appUrl(back)} />
        </div>
      </section>
      <TempoId tag={player.tag} />
    </div>
  );
}

function Profile({ player }: { player: Player }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={player.name} image={player.image} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="display truncate text-3xl">{player.name}</h1>
            <p className="truncate text-sm text-ink-3">{player.email}</p>
          </div>
          <div className="flex gap-2">
            {editing ? null : (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden /> Change name and picture
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={async () => {
                await flushDocs();
                await authClient.signOut();
                router.replace("/account");
              }}
            >
              <LogOut className="size-4" aria-hidden /> Sign out
            </Button>
          </div>
        </div>
        {editing ? <ProfileEditor player={player} onDone={() => setEditing(false)} /> : null}
      </section>
      <TempoId tag={player.tag} />
      <DeleteAccount />
    </div>
  );
}
