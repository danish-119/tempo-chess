"use client";

import { useCallback, useEffect } from "react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { type SoundKind, playSound, preloadSounds, soundForSan } from "@/lib/sound";

/** Settings-aware sound player. */
export function useSound() {
  const { settings } = useSettings();
  const volume = settings.sound ? settings.soundVolume : 0;
  // Decode the sound files after the first user interaction (autoplay policy).
  useEffect(() => {
    if (volume <= 0) return;
    const warm = () => preloadSounds();
    window.addEventListener("pointerdown", warm, { once: true });
    window.addEventListener("keydown", warm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, [volume]);
  const play = useCallback((kind: SoundKind) => playSound(kind, volume), [volume]);
  const playSan = useCallback((san: string) => playSound(soundForSan(san), volume), [volume]);
  return { play, playSan };
}
