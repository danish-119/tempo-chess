"use client";

import { useCallback, useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { IconButton } from "@/components/ui/primitives";
import { forSpeech, speak, speechSupported, stopSpeaking } from "@/lib/speech";

/**
 * The spoken coach for the learning pages. It says exactly what is written on the page (chess notation is read out
 * as words), follows the "Coach voice" setting, and stays silent where the browser cannot speak.
 */
export function useCoachVoice() {
  const { settings, update } = useSettings();
  /** Speech support is only known in the browser, so it is checked after the page has loaded. */
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setCanSpeak(speechSupported()), 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => stopSpeaking, []);

  const on = settings.coachVoice && canSpeak;
  const say = useCallback(
    (text: string, opts?: { onStart?: () => void; onEnd?: () => void }) => {
      if (on && text) speak(forSpeech(text), opts);
    },
    [on],
  );
  const toggle = useCallback(() => {
    if (on) stopSpeaking();
    update({ coachVoice: !on });
  }, [on, update]);

  return { canSpeak, on, say, toggle };
}

/** The speaker button that turns the coach's voice on and off. */
export function VoiceToggle({ voice, className }: { voice: ReturnType<typeof useCoachVoice>; className?: string }) {
  if (!voice.canSpeak) return null;
  return (
    <IconButton label={voice.on ? "Coach voice on. Turn off" : "Coach voice off. Turn on"} onClick={voice.toggle} className={className ?? "!size-8"}>
      {voice.on ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
    </IconButton>
  );
}
