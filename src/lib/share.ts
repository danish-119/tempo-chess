/**
 * Share links without a server: the PGN is compressed (deflate) and packed
 * into the URL *fragment* (`/analyze#pgn=…`). Browsers never send the
 * fragment to the host, so the game stays between the people sharing it.
 */
export const SHARE_PREFIX = "#pgn=";
/** Links above this length are unreliable in some chat apps and browsers. */
export const SHARE_MAX_CHARS = 16_000;

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = source.pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export async function encodeShare(pgn: string): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(pgn), new CompressionStream("deflate-raw"));
  return toBase64Url(packed);
}

export async function decodeShare(token: string): Promise<string> {
  const bytes = await pipe(fromBase64Url(token), new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(bytes);
}

export async function shareUrl(pgn: string, origin = window.location.origin): Promise<string> {
  return `${origin}/analyze${SHARE_PREFIX}${await encodeShare(pgn)}`;
}

/** The share token in a location hash, or null. */
export function shareTokenFromHash(hash: string): string | null {
  return hash.startsWith(SHARE_PREFIX) && hash.length > SHARE_PREFIX.length ? hash.slice(SHARE_PREFIX.length) : null;
}
