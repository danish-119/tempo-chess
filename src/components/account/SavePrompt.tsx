"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { onFirstSave } from "@/lib/account/session";
import { GuestSetup } from "./GuestSetup";

/**
 * A visitor's first save (a finished lesson, a setting, a reviewed game) asks how to keep it: as a guest with a
 * nickname and a picture, or with Google. Nothing is saved on the server until they choose. If another dialog is
 * open at that moment (Settings, say), this waits for it to close. Closing this one keeps their changes for now,
 * in memory only, and it asks again on their next visit.
 */
export function SavePrompt() {
  const [wanted, setWanted] = useState(false);
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("/");

  useEffect(() => {
    onFirstSave(() => setWanted(true));
    return () => onFirstSave(null);
  }, []);

  useEffect(() => {
    if (!wanted || open) return;
    const show = () => {
      if (document.querySelector('[role="dialog"]')) return false;
      setNext(location.pathname + location.search); // Google brings them back here
      setOpen(true);
      return true;
    };
    if (show()) return;
    const timer = setInterval(() => show() && clearInterval(timer), 300);
    return () => clearInterval(timer);
  }, [wanted, open]);

  const close = () => {
    setWanted(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={close} title="Save your progress" size="md">
      <GuestSetup next={next} action="Save as a guest" keep onDone={close} />
    </Dialog>
  );
}
