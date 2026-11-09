# Security policy

## Reporting a vulnerability

Please report security issues privately: email the address shown on the deployment's About page
(`NEXT_PUBLIC_CONTACT_EMAIL`), or open a private security advisory on the repository. Do not open a public issue for
an unpatched vulnerability. We aim to acknowledge reports within 7 days and to fix confirmed issues in accounts or
saved data first.

## What Tempo is made of

- **The app**: a static site. The engine, game review, puzzles and lessons run in the browser; there is no
  server-side rendering.
- **The API** (`server/`): a Cloudflare Worker with a D1 (SQLite) database. It handles accounts, saved data and
  online games. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Accounts

| Area | Measure |
| --- | --- |
| Sign-in | Google only: OAuth 2.0 with state and PKCE, handled by Better Auth. Tempo stores no passwords and sends no email, so there is nothing to reset, phish or enumerate. |
| Identity | Every player has a Tempo ID assigned by the server (7 random characters, unique, read-only: the client cannot set or change it) and a display name (2 to 24 letters, digits, spaces and a little punctuation, checked on the server). Names need not be unique, so nothing identifies a player by name. |
| Guests | A guest session (Better Auth anonymous plugin), started by a visitor's first save. Guests are players like any other, scoped to their own id; they are deleted, with their data, once they have had no live session for 30 days. A picture must be one of the offered DiceBear styles and seeds, on creation and on every update (anything else is refused). When a guest signs in with Google, their data moves to that account in one batch. |
| Sessions | HTTP-only, `Secure` cookies, prefixed `tempo`; `SameSite=Lax` when the app and the API share a domain (`COOKIE_DOMAIN`), `SameSite=None` when they are on different sites. 30 days, refreshed daily. A signed 5-minute cookie copy avoids a database read per request. |
| Rate limits | Per IP (`cf-connecting-ip`, set by Cloudflare and not spoofable), stored in D1: Google sign-in 10 per minute, guest sign-in 10 per 10 minutes, everything else 100 per minute. |
| Account deletion | Needs a sign-in from the last day (otherwise the player signs in with Google again). Deletes the account and, through foreign keys, every session, saved record, game and review belonging to it. |

## API

| Area | Measure |
| --- | --- |
| Origins | CORS allows only the app's own origins (`APP_ORIGIN`), with credentials. Every request that changes something must carry one of those origins in its `Origin` header (Better Auth checks its routes, the API checks the rest): this is the CSRF protection, so it holds even when the cookie is `SameSite=None`. |
| Authorisation | Every `/api/v1` route needs a session (an account or a guest), and every query is scoped to that player's id. |
| Input | Every body, path and query is schema-checked (zod). Request bodies are capped at 2 MB; saved records at 256 KB, games at 512 KB, reviews at 1 MB; at most 5,000 games per player. |
| Database | Drizzle ORM with parameterised queries only. Schema changes go through versioned migrations. |
| Concurrency | Saved records carry a version; a save based on an old version is refused with `409`, so devices cannot overwrite each other. |
| Errors | One JSON shape with a request id. Internal errors are logged with the request id and never returned to the client. |
| Headers | `secure-headers` defaults (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, …) and `Cross-Origin-Resource-Policy: same-site`. |
| Avatars | Pictures are fetched by the API and served from our own domain. Only two kinds of address are ever fetched: `lhN.googleusercontent.com` (Google photos) and `api.dicebear.com/9.x/{avataaars,open-peeps,thumbs}/png` (guest pictures), always rebuilt on the server from the style and an alphanumeric seed. No other user-supplied URL is fetched, so no SSRF; raster images only (no SVG), at most 512 KB. |
| Secrets | `BETTER_AUTH_SECRET` and the Google client secret are Worker secrets; locally they live in `server/.dev.vars`, which is git-ignored. Nothing secret is in the repository or the app bundle. |

## Online games

The server is the referee: it checks every move with chess.js, measures both clocks from its own timestamps and
decides every result. Messages are schema-checked, at most 1 KB, and rate-limited per connection; WebSocket upgrades
check the session and the `Origin` header. A player can only act in games they are seated in.

## The app

| Area | Measure |
| --- | --- |
| Remote requests | The Tempo API, plus `https://api.chess.com/pub/...`, `https://lichess.org/api/...` / `/game/export/...` and `https://tablebase.lichess.ovh/standard` through fixed URL builders. Third-party requests use `credentials: "omit"`, a serial queue, timeouts and bounded retries. |
| Pasted URLs | Never fetched. Chess.com game links are recognised and explained; anything else is rejected. |
| PGN input | 5 MB / 2,000 games / 1,200 plies limits; parsed with chess.js; never executed; file names are not used as paths. |
| Rendering | All user-controlled strings (display names, guest nicknames, player names, comments, headers) are rendered as React text. No `dangerouslySetInnerHTML`. Links from PGN are restricted to `http(s)`. |
| Browser storage | None for player data: it is loaded from the server into memory, and the only thing the browser keeps is the session cookie. The service worker caches the site itself. |
| Headers | CSP (`default-src 'self'`, `connect-src` limited to the API and the services above, `img-src` limited to the site and the API, `object-src 'none'`, `frame-ancestors 'none'`), COOP/COEP/CORP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`. Defined once in `scripts/headers.mjs`. The host configs are always written for the deployed API (`PRODUCTION_API_URL`, or an https `NEXT_PUBLIC_API_URL`), because hosts read them before building; the local preview allows the local API. |
| CSP notes | `'unsafe-inline'` scripts are needed for the Next.js static-export bootstrap; `'wasm-unsafe-eval'` for Stockfish. No `eval` in app code. |
| Tracking | None: no analytics, advertising or third-party scripts. The only cookies are the sign-in cookies. |

## Dependency audit status (2026-11-07)

- App, shipped dependencies (`npm audit --omit=dev`): **0 vulnerabilities**.
- App, including dev tools: 8 moderate, all in development tooling that is never shipped.
- API: 4 moderate, all from one `esbuild` advisory (GHSA-67mh-4wv8-2f99, the esbuild dev server) pulled in by
  `drizzle-kit`, the migration tool used only on developers' machines. None of it is in the deployed Worker.
  Re-check when `drizzle-kit` updates.
