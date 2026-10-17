import { z } from "zod";

export const SettingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).default("system"),
  engineMode: z.enum(["auto", "single"]).default("auto"),
  /** 0 = auto (use the device's cores). */
  threads: z.number().int().min(0).max(32).default(0),
  reviewPreset: z.enum(["quick", "standard", "deep"]).default("standard"),
  liveDepth: z.number().int().min(8).max(30).default(20),
  liveMultiPv: z.number().int().min(1).max(5).default(3),
  showArrows: z.boolean().default(true),
  showBoardBadges: z.boolean().default(true),
  showCoordinates: z.boolean().default(true),
  showLegalMoves: z.boolean().default(true),
  autoAnalyze: z.boolean().default(true),
  autoReview: z.boolean().default(true),
  pauseWhenHidden: z.boolean().default(true),
  animations: z.boolean().default(true),
  boardTheme: z.string().max(20).default("slate"),
  pieceSet: z.string().max(20).default("cburnett"),
  sound: z.boolean().default(true),
  soundVolume: z.number().min(0).max(1).default(0.6),
  showGlossaryHints: z.boolean().default(true),
  chessComUsername: z.string().max(25).default(""),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});
export const SETTINGS_KEY = "tempo:settings:v1";

/** Read settings from localStorage, tolerating missing or corrupt data. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultsForDevice();
    const parsed = SettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultsForDevice();
  } catch {
    return defaultsForDevice();
  }
}

export function saveSettings(s: Settings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** Lighter defaults for phones / low-core devices. */
function defaultsForDevice(): Settings {
  if (typeof navigator === "undefined") return DEFAULT_SETTINGS;
  const cores = navigator.hardwareConcurrency || 2;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (mobile || cores <= 4) {
    return { ...DEFAULT_SETTINGS, reviewPreset: "quick", liveDepth: 16, liveMultiPv: 2 };
  }
  return DEFAULT_SETTINGS;
}
