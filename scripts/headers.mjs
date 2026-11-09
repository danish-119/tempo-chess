// Single source of truth for HTTP response headers. `npm run headers`
// regenerates vercel.json and public/_headers from this file.
//
// COOP + COEP enable cross-origin isolation, which the multi-threaded
// Stockfish build needs (SharedArrayBuffer). Without them the app falls back
// to the single-threaded engine automatically.

// The live Tempo API. A fork deploying its own API sets NEXT_PUBLIC_API_URL (https) when it builds.
export const PRODUCTION_API_URL = "https://tempo-api.tempo-server.workers.dev";

/**
 * Which API the headers allow. The host configs (vercel.json, public/_headers) are read before the build runs, so
 * they are always written for the deployed API, never for a local one, whatever the current build points at. The
 * local preview server (scripts/serve.mjs) uses the API this machine runs.
 */
export function apiOrigin({ deployed }) {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (deployed) return new URL(configured?.startsWith("https://") ? configured : PRODUCTION_API_URL).origin;
  return new URL(configured || "http://localhost:8787").origin;
}

/** The Content-Security-Policy for an API origin. Online games and live notifications use WebSockets to the same host. */
export const csp = (api) => [
  "default-src 'self'",
  // Next.js static export inlines small bootstrap scripts; 'wasm-unsafe-eval'
  // is required to compile the Stockfish WebAssembly module.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${api}`,
  "font-src 'self'",
  `connect-src 'self' ${api} ${api.replace(/^http/, "ws")} https://api.chess.com https://lichess.org https://tablebase.lichess.ovh`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** Every security header, for an API origin. */
export const securityHeaders = (api) => ({
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": csp(api),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Frame-Options": "DENY",
});

export const ENGINE_CACHE = "public, max-age=31536000, immutable";

// The service worker and web manifest must always be revalidated so updates reach users.
export const SW_CACHE = "no-cache, max-age=0, must-revalidate";
