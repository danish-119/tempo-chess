"use client";

import { useCallback, useRef, useState } from "react";
import { useAccount } from "@/components/providers/AccountProvider";
import { Dialog } from "@/components/ui/Dialog";
import { GuestSetup } from "./GuestSetup";

/**
 * Online play needs a player: someone signed in with Google, or a guest with a nickname and a picture (a guest held
 * for a Google sign-in that was not finished is still just "Guest", with no picture). `needPlayer(action)` runs the action at once when
 * there is one; otherwise it opens a dialog to play as a guest or continue with Google, and runs the action as soon
 * as they have chosen. Google leaves the page and comes back to `next`, so the action is simply not run.
 */
export function usePlayAs(next: string) {
  const account = useAccount();
  const ready = account.status === "user" && !(account.player.guest && !account.player.image);
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const needPlayer = useCallback(
    (action: () => void) => {
      if (ready) return action();
      pending.current = action;
      setOpen(true);
    },
    [ready],
  );

  const close = useCallback(() => {
    pending.current = null;
    setOpen(false);
  }, []);

  const dialog = (
    <Dialog open={open} onClose={close} title="Play as a guest, or continue with Google" size="md">
      <GuestSetup
        next={next}
        onDone={() => {
          const action = pending.current;
          pending.current = null;
          setOpen(false);
          action?.();
        }}
      />
    </Dialog>
  );

  return { ready, needPlayer, dialog };
}
