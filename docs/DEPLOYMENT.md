# Deployment

Tempo has two parts: the app (a static folder, `out/`) and the API (`server/`, a Cloudflare Worker with a D1
database). Deploy the API first, then build the app pointing at it.

## The API (Cloudflare Workers)

1. `cd server && npm install`, then `npx wrangler login`.
2. Create the database: `npx wrangler d1 create tempo`, and put the printed `database_id` in `wrangler.jsonc`.
3. Apply the migrations: `npm run db:migrate:remote`.
4. Secrets: `npx wrangler secret put BETTER_AUTH_SECRET` (32+ random bytes, e.g. `openssl rand -base64 32`), and for
   Google sign-in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Google Cloud console → OAuth client → Web; authorised
   redirect URI `https://<api host>/api/auth/callback/google`).
5. Vars in `wrangler.jsonc`: `APP_ORIGIN` (the app's origin; several, comma-separated, for previews; game links use
   the first), `BETTER_AUTH_URL` (the API's own origin), and `COOKIE_DOMAIN` (the shared parent domain, e.g.
   `tempochess.com`, when the app and the API are on sibling hosts). The daily guest clean-up runs from the cron
   trigger in `wrangler.jsonc`; nothing to set up.
6. `npm run deploy`.

**Two sites or one.** The app and the API can be on different sites (such as `tempochess.vercel.app` and
`tempo-api.<you>.workers.dev`): then the session cookie is sent cross-site (`SameSite=None; Secure`) and every
change is checked against `APP_ORIGIN` instead. Chrome and Edge keep the session; Safari, Firefox (which partitions
third-party cookies) and private windows may not. With a domain of your own, put both on it
(for example `tempochess.com` and `api.tempochess.com`) and set `COOKIE_DOMAIN`: the cookie becomes first-party
(`SameSite=Lax`) and works in every browser.

**Schema changes.** Edit `server/src/db/schema.ts`, run `npm run db:generate`, review the SQL in
`server/migrations`, then `npm run db:migrate:remote` before deploying code that needs it.

## The app

Tempo's app builds to a static folder (`out/`). Any static host works if it can send custom headers. Cross-origin isolation (COOP/COEP) enables the faster multi-threaded engine; without it Tempo still works with the single-threaded engine.

## Vercel (recommended)

1. Push the repository to GitHub (public, for GPL source availability).
2. Import it in Vercel. `vercel.json` already sets `framework: null` (static site), `buildCommand`, `outputDirectory: out` and all headers — leave the project's Framework Preset / Output Directory overrides off. (With the Next.js preset the build fails with `NEXT_NO_ROUTES_MANIFEST`, because a static export has no `routes-manifest.json`.)
3. Env vars (Project → Settings → Environment Variables): `NEXT_PUBLIC_API_URL` (the API's origin; if it is not the one in `PRODUCTION_API_URL` in `scripts/headers.mjs`, also run `NEXT_PUBLIC_API_URL=<it> npm run headers` and commit `vercel.json`, because Vercel reads the headers before building), and optionally `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_REPO_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`.
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
- Analysis of a ≤ 7-piece position shows the tablebase verdict.
- Sounds play after the first move.
- `/account` → Continue with Google → back on Tempo signed in, with your avatar in the header and a Tempo ID on the account page. Reload: still signed in.
- In a private window, change a setting: the header shows a Guest picture menu; reload, and the setting is still there. Play → Play online → pick a nickname and a picture → Create a game works without an account.
- Play → Play online → Create a game, then open its link in a second browser signed in as another player: both see the board and the clocks, and a third (signed-out) browser can watch.
- `/about` shows the source link (github.com/danish-119/tempo-chess by default; override with `NEXT_PUBLIC_REPO_URL`).

## Rollback

App deployments are immutable: on Vercel/Netlify/Cloudflare, promote the previous deployment from the dashboard. The API can be rolled back with `npx wrangler rollback`. Database migrations are forward-only: write them so the previous version of the code still works (add columns and tables first, remove them in a later release). `REVIEW_VERSION` upgrades keep raw engine data, so older app versions still read reviews.

## Changing headers

Edit `scripts/headers.mjs`, then `npm run headers` (also run automatically by `npm run build`) to regenerate `vercel.json` and `public/_headers`.
