# Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Engine tab says "single thread" | The page isn't cross-origin isolated. In dev, restart `npm run dev` (headers are set in `next.config.ts`). In production, check that COOP `same-origin` and COEP `require-corp` headers are served (vercel.json / `_headers`). Also check Settings → "Force single-threaded engine" is off. |
| "Engine unavailable" | `/engine/*.wasm` missing or blocked. Run `npm run dev`/`build` (they copy the engine), check the network tab for 404s/MIME type `application/wasm`, try Settings → force single-threaded, or another browser. |
| Engine very slow / device hot | Lower threads in Settings, use the Quick review preset, reduce engine lines. |
| Chess.com: "No public account" | Username typo, closed account, or no public games. |
| Chess.com: rate-limited | Wait a minute; Tempo already sends requests one at a time and caches results. |
| A game I just played is missing | Chess.com archives update with a delay. Paste the game's PGN instead (Share → PGN on Chess.com). |
| No sounds | Sounds start after your first click/key press (browser autoplay rules). Check Settings → Sounds and volume. |
| Saved data disappeared | Private browsing or cleared site data. A warning appears when storage is unavailable. |
| Old review shows odd categories | Open the game once — reviews saved under older rules are rebuilt automatically from stored engine output. |
| `tsc` errors under `.next/types` after renaming routes | Delete `.next/types` (stale generated files) and re-run. |
| `npm install` fails with `spawn cmd.exe ENOENT` (Windows Git Bash) | Run npm from PowerShell/cmd instead. |
| E2E tests fail to start | `npm run build` first, then `npx playwright install chromium` once. Port 4173 must be free. |
