"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, type Settings, loadSettings, saveSettings } from "@/lib/settings";

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useEffect(() => {
    const loaded = loadSettings();
    // Hydrate from localStorage after mount (not available during prerender).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loaded);
    setReady(true);
    applyTheme(loaded.theme);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      if (patch.theme) applyTheme(next.theme);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    applyTheme(DEFAULT_SETTINGS.theme);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(
    () => ({ settings, ready, update, reset, settingsOpen, openSettings, closeSettings }),
    [settings, ready, update, reset, settingsOpen, openSettings, closeSettings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
