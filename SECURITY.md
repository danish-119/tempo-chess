# Security policy

## Reporting a vulnerability

Please report security issues privately to the maintainers (see `NEXT_PUBLIC_CONTACT_EMAIL` of the deployment, or open a private security advisory on the repository). Do not open a public issue for an unpatched vulnerability. We aim to acknowledge reports within 7 days.

## Security model

Tempo is a static, client-only web app. There is no server-side code, database, authentication or secret in production.

| Area | Measure |
| --- | --- |
| Remote requests | Only `https://api.chess.com/pub/...`, `https://lichess.org/api/...` / `/game/export/...`, `https://tablebase.lichess.ovh/standard` and `https://explorer.lichess.org/{masters,lichess}` (enforced by allow-lists / fixed URL builders); serial queue, timeouts, bounded retries; `credentials: "omit"`. No proxy exists, so there is no SSRF surface. |
| Pasted URLs | Never fetched. Chess.com game links are recognised and explained; anything else is rejected. |
| PGN input | 5 MB / 2,000 games / 1,200 plies limits; parsed with chess.js; never executed; file names are not used as paths. |
| Rendering | All user-controlled strings (player names, comments, headers) are rendered as React text. No `dangerouslySetInnerHTML` except the static theme bootstrap script. Links from PGN are restricted to `http(s)`. |
| Lichess login | Optional OAuth 2.0 Authorization Code + PKCE (S256) entirely in the browser; no client secret exists. `state` is checked, the verifier lives in sessionStorage for one round trip, no scopes are requested, the return path is restricted to same-site paths, and the token (localStorage) is sent only to `explorer.lichess.org` / `lichess.org`. Disconnect revokes it (`DELETE /api/token`); a 401 drops it. |
| Headers | CSP (`default-src 'self'`, `connect-src 'self' https://api.chess.com https://lichess.org https://explorer.lichess.org https://tablebase.lichess.ovh`, `object-src 'none'`, `frame-ancestors 'none'`), COOP/COEP/CORP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`. Defined once in `scripts/headers.mjs`. |
| CSP notes | `'unsafe-inline'` scripts are needed for Next.js static-export bootstrap; `'wasm-unsafe-eval'` for Stockfish. No `eval` in app code. |
| Storage | IndexedDB/localStorage only; quota and corruption errors are surfaced; "Delete all local data" in Settings. |
| Tracking | None. No analytics, cookies or third-party scripts. |
| Dependencies | `npm audit` as part of release checks; engine binaries come from a pinned npm version. |

## Dependency audit status (2026-10-16)

- `npm audit --omit=dev`: **0 vulnerabilities** in shipped (runtime) dependencies.
- `npm audit` (including dev tools): 5 high-severity entries, all from one `braces` advisory pulled in by `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob`. It affects lint tooling only and is never shipped to users; the suggested `--force` fix installs a breaking version. Re-check when `eslint-config-next` updates.
