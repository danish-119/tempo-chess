// Single source of truth for HTTP response headers. `npm run headers`
// regenerates vercel.json and public/_headers from this file.
//
// COOP + COEP enable cross-origin isolation, which the multi-threaded
// Stockfish build needs (SharedArrayBuffer). Without them the app falls back
// to the single-threaded engine automatically.

export const CSP = [
  "default-src 'self'",
  // Next.js static export inlines small bootstrap scripts; 'wasm-unsafe-eval'
  // is required to compile the Stockfish WebAssembly module.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.chess.com https://lichess.org https://explorer.lichess.org https://tablebase.lichess.ovh",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const SECURITY_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Frame-Options": "DENY",
};

export const ENGINE_CACHE = "public, max-age=31536000, immutable";
