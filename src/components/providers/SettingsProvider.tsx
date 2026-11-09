"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { docsReady } from "@/lib/account/docs";
import { subscribeAccount } from "@/lib/account/session";
import { boardTheme } from "@/lib/appearance";
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

/** The chosen board colours, for everything that draws squares (mini boards, quizzes, previews), not just the main board. */
function applyBoardTheme(id: string) {
  const t = boardTheme(id);
  const root = document.documentElement;
  root.style.setProperty("--sq-light", t.light);
  root.style.setProperty("--sq-dark", t.dark);
}

function applyColorBlind(on: boolean) {
  const root = document.documentElement;
  if (on) root.setAttribute("data-cb", "on");
  else root.removeAttribute("data-cb");
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  // Take the account's settings once they are loaded (and again after signing in or out).
  useEffect(() => {
    const sync = () => {
      const loaded = loadSettings();
      setSettings(loaded);
      applyTheme(loaded.theme);
      applyColorBlind(loaded.colorBlindSafe);
      applyBoardTheme(loaded.boardTheme);
    };
    let alive = true;
    void docsReady().then(() => {
      if (!alive) return;
      sync();
      setReady(true);
    });
    const off = subscribeAccount(() => void docsReady().then(() => alive && sync()));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      if (patch.theme) applyTheme(next.theme);
      if (patch.colorBlindSafe !== undefined) applyColorBlind(next.colorBlindSafe);
      if (patch.boardTheme) applyBoardTheme(next.boardTheme);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    applyTheme(DEFAULT_SETTINGS.theme);
    applyColorBlind(DEFAULT_SETTINGS.colorBlindSafe);
    applyBoardTheme(DEFAULT_SETTINGS.boardTheme);
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
