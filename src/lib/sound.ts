/**
 * Sound effects.
 *
 * Primary: the Lichess "SFX" sound set by Enigmahack (AGPL-3.0-or-later,
 * see THIRD_PARTY_LICENSES.md), served from /sounds/sfx. Files are fetched
 * and decoded once, then played through Web Audio for low latency.
 * Fallback: small synthesised sounds if a file cannot be loaded.
 *
 * The AudioContext is created lazily on the first sound, which follows a user
 * gesture (a move or a click), satisfying browser autoplay policies.
 */
export type SoundKind =
  | "move"
  | "capture"
  | "check"
  | "castle"
  | "promote"
  | "game-end"
  | "correct"
  | "incorrect"
  | "victory"
  | "defeat"
  | "draw";

const SAMPLE: Record<SoundKind, string> = {
  move: "Move",
  castle: "Move",
  promote: "Move",
  capture: "Capture",
  check: "Check",
  "game-end": "Check",
  correct: "GenericNotify",
  incorrect: "Defeat",
  victory: "Victory",
  defeat: "Defeat",
  draw: "Draw",
};
const SAMPLE_BASE = "/sounds/sfx";
const samples = new Map<string, Promise<AudioBuffer | null>>();

function sampleExt(): "ogg" | "mp3" {
  try {
    return typeof Audio !== "undefined" && new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? "ogg" : "mp3";
  } catch {
    return "mp3";
  }
}

function loadSample(c: AudioContext, name: string): Promise<AudioBuffer | null> {
  let p = samples.get(name);
  if (!p) {
    p = fetch(`${SAMPLE_BASE}/${name}.${sampleExt()}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((buf) => c.decodeAudioData(buf))
      .catch(() => null);
    samples.set(name, p);
  }
  return p;
}

/** Warm the cache so the first move sound plays without delay. */
export function preloadSounds(): void {
  const c = audio();
  if (!c) return;
  for (const name of new Set(Object.values(SAMPLE))) void loadSample(c, name);
}

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): Ctx | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: Ctx): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
  const len = Math.floor(c.sampleRate * 0.08);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  noiseBuffer = buf;
  return buf;
}

/** A short wooden "tock": band-passed noise transient plus a low body tone. */
function tock(c: Ctx, out: AudioNode, at: number, { freq = 1700, body = 170, gain = 1 } = {}) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.9 * gain, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  src.connect(bp).connect(g).connect(out);
  src.start(at);
  src.stop(at + 0.08);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(body, at);
  osc.frequency.exponentialRampToValueAtTime(body * 0.6, at + 0.08);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, at);
  og.gain.exponentialRampToValueAtTime(0.5 * gain, at + 0.004);
  og.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  osc.connect(og).connect(out);
  osc.start(at);
  osc.stop(at + 0.1);
}

function tone(c: Ctx, out: AudioNode, at: number, freq: number, dur: number, { type = "sine" as OscillatorType, gain = 0.3, to }: { type?: OscillatorType; gain?: number; to?: number } = {}) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export function playSound(kind: SoundKind, volume: number): void {
  if (volume <= 0) return;
  const c = audio();
  if (!c) return;
  void loadSample(c, SAMPLE[kind]).then((buffer) => {
    if (buffer) {
      const src = c.createBufferSource();
      src.buffer = buffer;
      const g = c.createGain();
      g.gain.value = Math.min(1, Math.max(0, volume));
      src.connect(g).connect(c.destination);
      src.start();
      src.onended = () => g.disconnect();
    } else {
      synth(c, kind, volume);
    }
  });
}

function synth(c: AudioContext, kind: SoundKind, volume: number): void {
  const out = c.createGain();
  out.gain.value = Math.min(1, Math.max(0, volume)) * 0.6;
  out.connect(c.destination);
  const t = c.currentTime + 0.005;
  switch (kind) {
    case "move":
      tock(c, out, t);
      break;
    case "capture":
      tock(c, out, t, { freq: 2200, body: 200, gain: 1.2 });
      tock(c, out, t + 0.045, { freq: 1100, body: 130, gain: 0.8 });
      break;
    case "castle":
      tock(c, out, t);
      tock(c, out, t + 0.1, { freq: 1500, body: 150 });
      break;
    case "check":
      tock(c, out, t, { gain: 1.1 });
      tone(c, out, t + 0.02, 880, 0.18, { gain: 0.12, type: "triangle" });
      break;
    case "promote":
      tock(c, out, t);
      tone(c, out, t + 0.03, 520, 0.22, { gain: 0.14, to: 1040 });
      break;
    case "game-end":
      tock(c, out, t);
      [523.25, 659.25, 783.99].forEach((f, i) => tone(c, out, t + 0.05 + i * 0.07, f, 0.6, { gain: 0.1 }));
      break;
    case "victory":
    case "draw":
    case "correct":
      tone(c, out, t, 660, 0.12, { gain: 0.16 });
      tone(c, out, t + 0.1, 990, 0.2, { gain: 0.16 });
      break;
    case "defeat":
    case "incorrect":
      tone(c, out, t, 220, 0.2, { gain: 0.12, type: "triangle", to: 180 });
      break;
  }
  // Disconnect the per-sound gain once everything has played.
  setTimeout(() => out.disconnect(), 1000);
}

/** Choose the right sound for a move from its SAN. */
export function soundForSan(san: string): SoundKind {
  if (san.includes("#")) return "game-end";
  if (san.includes("+")) return "check";
  if (san.includes("=")) return "promote";
  if (san.startsWith("O-O")) return "castle";
  if (san.includes("x")) return "capture";
  return "move";
}
