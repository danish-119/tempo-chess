import { readDoc, writeDoc } from "@/lib/account/docs";
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
  /** The evaluation bar beside the board in Play with Coach and Watch engines. */
  showEvalBar: z.boolean().default(true),
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
  /** Colour-blind-safe move-quality palette (Okabe-Ito). */
  colorBlindSafe: z.boolean().default(false),
  /** Spoken (screen-reader) announcement of every move shown on the board. */
  announceMoves: z.boolean().default(true),
  /** The coach reads its feedback and hints aloud (browser speech synthesis). */
  coachVoice: z.boolean().default(true),
  chessComUsername: z.string().max(25).default(""),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});
/** Read settings from the account or guest session, tolerating missing or damaged data. */
export function loadSettings(): Settings {
  const parsed = SettingsSchema.safeParse(readDoc<unknown>("settings", null));
  return parsed.success ? parsed.data : defaultsForDevice();
}

export function saveSettings(s: Settings): boolean {
  writeDoc("settings", s);
  return true;
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
