/**
 * Serverless signalling for peer-to-peer games. The WebRTC "offer" and
 * "answer" are packed into short URL-safe strings that players exchange
 * themselves (a link and a reply code), so no server ever sees them.
 */
export interface Signal {
  type: "offer" | "answer";
  sdp: string;
}

const PREFIX_RAW = "r."; // uncompressed
const PREFIX_DEFLATE = "d."; // deflate-raw

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // A corrupt code makes these reject too; the read below reports the failure to the caller.
  writer.write(bytes as BufferSource).catch(() => undefined);
  writer.close().catch(() => undefined);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** Keep only what a data-channel connection needs, to shorten the code. */
export function trimSdp(sdp: string): string {
  return sdp
    .split(/\r?\n/)
    .filter((line) => line.length > 0 && !/^a=(extmap-allow-mixed|msid-semantic)/.test(line))
    .join("\r\n")
    .concat("\r\n");
}

export async function encodeSignal(signal: Signal): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify({ t: signal.type === "offer" ? "o" : "a", s: trimSdp(signal.sdp) }));
  if (typeof CompressionStream !== "undefined") {
    return PREFIX_DEFLATE + toBase64Url(await pipe(payload, new CompressionStream("deflate-raw")));
  }
  return PREFIX_RAW + toBase64Url(payload);
}

export async function decodeSignal(code: string): Promise<Signal | null> {
  const text = code.trim().replace(/\s+/g, "");
  try {
    let json: string;
    if (text.startsWith(PREFIX_DEFLATE)) {
      if (typeof DecompressionStream === "undefined") return null;
      json = new TextDecoder().decode(await pipe(fromBase64Url(text.slice(PREFIX_DEFLATE.length)), new DecompressionStream("deflate-raw")));
    } else if (text.startsWith(PREFIX_RAW)) {
      json = new TextDecoder().decode(fromBase64Url(text.slice(PREFIX_RAW.length)));
    } else {
      return null;
    }
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    const { t, s } = parsed as { t?: unknown; s?: unknown };
    if ((t !== "o" && t !== "a") || typeof s !== "string" || s.length > 20_000 || !s.startsWith("v=0")) return null;
    return { type: t === "o" ? "offer" : "answer", sdp: s };
  } catch {
    return null;
  }
}

/** Pull the invite code out of a pasted link (or return the text unchanged if it already is a code). */
export function extractCode(input: string): string {
  const text = input.trim();
  const hash = text.indexOf("#");
  if (hash >= 0) {
    const params = new URLSearchParams(text.slice(hash + 1));
    return params.get("o") ?? params.get("a") ?? "";
  }
  return text;
}
