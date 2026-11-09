"use client";

import { useState } from "react";
import { Alert, Button, Field, cx, inputClass } from "@/components/ui/primitives";
import { refreshPlayer, useAccount } from "@/components/providers/AccountProvider";
import { appUrl, authClient } from "@/lib/account/auth-client";
import { guestPictureUrl, startGuest } from "@/lib/account/guest";
import { AvatarPicker, useNewPicture } from "./AvatarPicker";
import { GoogleButton } from "./GoogleButton";

const NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.'-]{1,23}$/u;

/**
 * Play without an account: choose a nickname and a picture. A visitor becomes a guest (with a Tempo ID, saved on the
 * server while they keep coming back); a guest who is already here (made quietly by a first save) just sets their
 * name and picture. Signing in with Google instead keeps everything for good.
 *
 * `edit` is the guest changing their profile (a Save button, no Google choice). `onDone` runs once they are ready.
 */
export function GuestSetup({ next, onDone, edit = false }: { next: string; onDone?: () => void; edit?: boolean }) {
  const account = useAccount();
  const isGuest = account.status === "user" && account.player.guest;
  const editing = edit && isGuest;
  const [name, setName] = useState(() => (isGuest && account.player.name !== "Guest" ? account.player.name : ""));
  const [picture, setPicture, options, shuffle] = useNewPicture();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tidy = name.replace(/\s+/g, " ").trim();
  const valid = NAME.test(tidy);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      if (isGuest) {
        const { error: err } = await authClient.updateUser({ name: tidy, image: guestPictureUrl(picture.style, picture.seed) });
        if (err) throw Object.assign(new Error(err.message), { status: err.status });
        await refreshPlayer();
      } else {
        await startGuest({ name: tidy, avatar: picture });
      }
      setBusy(false);
      onDone?.();
      return;
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 429 ? "Too many tries. Please wait a few minutes." : (err as Error).message || "That did not work. Please try again.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={start} className="space-y-3" noValidate>
        <Field label="Your nickname" error={tidy && !valid ? "2 to 24 letters, numbers or spaces." : null}>
          {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" className={cx(inputClass, "h-10")} />}
        </Field>
        <AvatarPicker picture={picture} onChange={setPicture} options={options} onShuffle={shuffle} />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" variant="primary" className="h-11 w-full" loading={busy} disabled={!valid}>
          {editing ? "Save" : "Play as a guest"}
        </Button>
      </form>

      {editing ? null : (
        <>
          <div className="flex items-center gap-3 text-xs text-ink-3">
            <span className="h-px flex-1 bg-border" /> or keep everything for good <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleButton callback={appUrl(next)} />
        </>
      )}
    </div>
  );
}
