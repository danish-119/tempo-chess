import type { CoachFeedback } from "@/lib/coach";
import { MOVE_CLASS_PHRASE } from "@/lib/review/types";

/**
 * Spoken coach. Uses the browser's built-in speech synthesis (Web Speech
 * API): nothing is uploaded and no extra package is needed. Where the browser
 * has no voices the coach simply stays silent and the text is still shown.
 */
export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Faster than the browser default (1.0) so feedback does not drag; the range is 0.1 to 10. */
export const DEFAULT_RATE = 1.5;

let cachedVoice: SpeechSynthesisVoice | null | undefined;

/** Best available English voice, preferring natural/online ones. */
export function pickVoice(voices: SpeechSynthesisVoice[], lang = "en"): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  if (en.length === 0) return null;
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google|microsoft|samantha|daniel|aria|jenny/i.test(v.name) ? 2 : 0) + (v.default ? 1 : 0);
  return [...en].sort((a, b) => score(b) - score(a))[0];
}

function voice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined && cachedVoice !== null) return cachedVoice;
  cachedVoice = pickVoice(window.speechSynthesis.getVoices());
  return cachedVoice;
}

/** Speak `text`, replacing anything still being said. Safe to call anywhere; no-op if unsupported. */
export function speak(text: string, opts: { rate?: number; volume?: number } = {}): void {
  if (!speechSupported() || !text.trim()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-US";
    u.rate = opts.rate ?? DEFAULT_RATE;
    u.volume = opts.volume ?? 1;
    synth.speak(u);
  } catch {
    /* speech is a nicety; never break the game */
  }
}

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

/** Turn "Nf3+" style notation into words a speech engine reads correctly. */
export function sanToSpeech(san: string): string {
  if (/^O-O-O/.test(san)) return "queen-side castles";
  if (/^O-O/.test(san)) return "castles king-side";
  const names: Record<string, string> = { N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };
  let rest = san;
  let piece = "pawn";
  if (/^[NBRQK]/.test(rest)) {
    piece = names[rest[0]];
    rest = rest.slice(1);
  }
  const suffix = rest.endsWith("#") ? ", checkmate" : rest.endsWith("+") ? ", check" : "";
  rest = rest.replace(/[+#]/g, "");
  const promo = /=([NBRQ])/.exec(rest);
  rest = rest.replace(/=[NBRQ]/, "");
  const capture = rest.includes("x");
  const target = rest.replace("x", "").slice(-2);
  const from = rest.replace("x", "").slice(0, -2);
  const fromText = from ? ` from ${from}` : "";
  return `${piece}${fromText}${capture ? " takes" : " to"} ${target}${promo ? `, promotes to ${names[promo[1]]}` : ""}${suffix}`;
}

/** A sentence that quotes an engine evaluation (+0.44, −0.11, M3, win %), which is pointless to hear. */
const EVAL_NUMBER = /[+−-]\d+\.\d{2}|\bM\d+\b|\d+(?:\.\d+)?\s?%/;

/** Move notation that cannot be mistaken for a plain square: Nf3, exd5, Qxh7#, O-O. */
const SAN_TOKEN = /\b(?:O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8][+#]?|[a-h]x[a-h][1-8][+#]?)(?![\w-])/g;

/**
 * The on-screen explanation, made fit to be heard: bracketed move lists and
 * any sentence that quotes evaluation numbers are dropped (the screen still
 * shows them), and notation inside a sentence is read as words.
 */
export function forSpeech(text: string): string {
  const withoutBrackets = text.replace(/\s*\([^)]*\)/g, "");
  const sentences = withoutBrackets
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !EVAL_NUMBER.test(s));
  return sentences.map((s) => s.replace(SAN_TOKEN, (m) => sanToSpeech(m))).join(" ");
}

/** What the coach says after the player's move, e.g. "Knight to f3 is best. This develops…". */
export function coachSpeechText(fb: CoachFeedback, playedSan: string | undefined): string {
  const parts: string[] = [];
  const phrase = MOVE_CLASS_PHRASE[fb.classification];
  parts.push(playedSan ? `${sanToSpeech(playedSan)} ${phrase}.` : `That move ${phrase}.`);
  const explanation = forSpeech(fb.explanation.text);
  if (explanation) parts.push(explanation);
  if (fb.bestSan && playedSan && fb.bestSan !== playedSan && ["inaccuracy", "mistake", "blunder", "missed-win"].includes(fb.classification)) {
    parts.push(`A better move was ${sanToSpeech(fb.bestSan)}.`);
  }
  return parts.join(" ");
}
