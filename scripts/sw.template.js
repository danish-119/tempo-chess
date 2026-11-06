/* Tempo service worker — generated into out/sw.js by scripts/gen-sw.mjs.
 *
 * Everything the app needs is precached on install, so Tempo opens and works
 * (including the Stockfish engine, puzzles and lessons) with no connection.
 * Navigations try the network first so a new deploy shows up immediately;
 * all other same-origin files are served cache-first. Cross-origin requests
 * (Chess.com / Lichess imports, tablebase, opening explorer) are never touched.
 */
const CACHE = "tempo-__VERSION__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tempo-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const path = new URL(request.url).pathname;
    const hit = (await cache.match(request, { ignoreSearch: true })) || (await cache.match(path)) || (await cache.match("/"));
    return hit || new Response("Tempo is offline and this page has not been saved yet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(request.mode === "navigate" ? networkFirst(request) : cacheFirst(request));
});
