# Deployment

Tempo builds to a static folder (`out/`). Any static host works if it can send custom headers. Cross-origin isolation (COOP/COEP) enables the faster multi-threaded engine; without it Tempo still works with the single-threaded engine.

## Vercel (recommended)

1. Push the repository to GitHub (public, for GPL source availability).
2. Import it in Vercel. `vercel.json` already sets `framework: null` (static site), `buildCommand`, `outputDirectory: out` and all headers — leave the project's Framework Preset / Output Directory overrides off. (With the Next.js preset the build fails with `NEXT_NO_ROUTES_MANIFEST`, because a static export has no `routes-manifest.json`.)
3. Optional env vars (Project → Settings → Environment Variables): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_REPO_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`.
4. Deploy. Verify (see checklist below).

Free (Hobby) tier: non-commercial use and a monthly bandwidth allowance — check vercel.com/pricing for current limits. A first visit transfers roughly 1.5–2 MB compressed (mostly the engine, cached afterwards).

## Cloudflare Pages / Netlify

- Build command `npm run build`, output directory `out`.
- `public/_headers` (generated from `scripts/headers.mjs`) is copied into `out/` and applies the same headers on both hosts.
- Cloudflare Pages' free tier currently does not meter static bandwidth — a good fallback if traffic grows.

## Self-hosting

Serve `out/` with any web server, applying the headers from `scripts/headers.mjs` and MIME types `application/wasm` for `.wasm`. `npm start` runs `scripts/serve.mjs`, a minimal reference server with those headers (fine for previews; use a hardened server such as nginx/Caddy in production).

## Post-deploy checklist

- `/analyze` → Engine tab shows "Stockfish 19 Lite WASM · N threads" (multi-thread confirms COOP/COEP work).
- DevTools → Network: `/engine/stockfish-19-lite.wasm` is `application/wasm`, cached `immutable`.
- Import a Chess.com username → games list loads (CSP `connect-src` allows `api.chess.com`).
- Analysis of a ≤ 7-piece position shows the tablebase verdict; Explorer tab → Connect Lichess → returns to the same position with explorer data (the OAuth redirect URI is `<your origin>/auth/lichess`; no registration needed).
- Sounds play after the first move.
- `/about` shows the source link (github.com/danish-119/tempo-chess by default; override with `NEXT_PUBLIC_REPO_URL`).

## Rollback

Static deployments are immutable: on Vercel/Netlify/Cloudflare, promote the previous deployment from the dashboard. There is no database or migration to roll back. User data lives in each browser; `REVIEW_VERSION` upgrades are forward-only but keep raw engine data, so older app versions still read reviews (they may ignore new categories).

## Changing headers

Edit `scripts/headers.mjs`, then `npm run headers` (also run automatically by `npm run build`) to regenerate `vercel.json` and `public/_headers`.
