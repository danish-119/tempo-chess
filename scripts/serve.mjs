// Minimal static server for previewing the production build (`out/`) with
// the same headers as production. Usage: node scripts/serve.mjs [port]
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_CACHE, SECURITY_HEADERS } from "./headers.mjs";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", "out"));
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const noIsolation = process.env.NO_ISOLATION === "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^([/\\])+/, "");
  const candidate = resolve(root, clean);
  if (!candidate.startsWith(root)) return null; // path traversal guard
  const options = [candidate, `${candidate}.html`, join(candidate, "index.html")];
  return options.find((p) => existsSync(p) && statSync(p).isFile()) ?? null;
}

createServer((req, res) => {
  const file = resolveFile(req.url ?? "/");
  const headers = { ...SECURITY_HEADERS };
  if (noIsolation) {
    delete headers["Cross-Origin-Opener-Policy"];
    delete headers["Cross-Origin-Embedder-Policy"];
  }
  if (!file) {
    const notFound = join(root, "404.html");
    res.writeHead(404, { ...headers, "Content-Type": MIME[".html"] });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end("Not found");
    return;
  }
  const type = MIME[extname(file)] ?? "application/octet-stream";
  if (file.includes(`${join("engine", "")}`)) headers["Cache-Control"] = ENGINE_CACHE;
  res.writeHead(200, { ...headers, "Content-Type": type });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`Tempo production preview on http://localhost:${port}${noIsolation ? " (no cross-origin isolation)" : ""}`);
});
