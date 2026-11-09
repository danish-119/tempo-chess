# Architecture

Tempo has two parts:

- **The app**: a static Next.js (App Router) site. The board, the engine (Stockfish compiled to WebAssembly), game
  review, puzzles and lessons all run in the browser. `next build` produces `out/`, served by any static host
  (Vercel in production).
- **The API** (`server/`): a Cloudflare Worker that adds what a browser cannot do on its own: accounts, saving a
  player's data across devices, and playing other people live.

```text
Browser
 ├─ React UI (src/app, src/components)
 │    └─ hooks: useEngine · useLiveAnalysis · useReview · useSound · useCoachVoice
 ├─ Web Worker: Stockfish 19 lite (WASM)  ← /engine/*.js|.wasm
 ├─ memory: the player's data (loaded from the API); a visitor's until they choose guest or Google
 ├─ fetch → Tempo API (accounts and saved data, with the sign-in cookie)
 ├─ fetch → https://api.chess.com/pub/... · https://lichess.org/api/... (imports)
 ├─ WebSocket → Tempo API (a live game)
 └─ fetch → https://tablebase.lichess.ovh (≤ 7 pieces, analysis)

Tempo API (Cloudflare Workers, Hono)
 ├─ /api/auth/*        Better Auth: Google sign-in, guest sessions, sessions, account deletion
 ├─ /api/v1/...        the player's saved data
 ├─ /api/v1/online/... create / join / cancel games
 ├─ /api/online/:code  game info and the game socket (spectators need no account)
 ├─ Durable Objects: GameRoom (one per game)
 └─ D1 (SQLite): users, sessions, saved data, games, reviews, online games
```

Both run close to the player and cost nothing while idle.

## Principles

1. **The browser does the heavy lifting.** Engine analysis stays on the player's device: free, fast and private.
2. **The server is the referee.** For online games, clients send intentions ("play e2e4"); the server checks every
   move, keeps the clocks from its own timestamps and decides every result.
3. **One owner per piece of live state.** Each game and each player's inbox is owned by exactly one Durable
   Object, which handles its events one at a time: no locks, no races between servers.
4. **Durable first, memory second.** State is written before it is acknowledged; memory is only a cache.
5. **Idempotent everything.** Moves carry their move number, alarms re-check state before acting, saves carry a
   version, and results are written once, so retries and duplicates are harmless.

## The app

### Directory map

| Path | Responsibility |
| --- | --- |
| `src/app/*` | Routes: `/` landing, `/play` (`?mode=online|bot|coach|person|engines`), `/play/game?code=…` (an online game), `/review` (import), `/analyze`, `/editor` (reached from Play), `/practice` (Puzzles · Puzzle Rush · Endgames · Coordinates), `/learn` (Basics · Openings · Tactics · Glossary), `/progress`, `/account`, `/about`, `/privacy`, `/terms` (Settings is a modal) |
| `src/components/board` | Board wrapper (click/drag moves, promotion dialog, highlights, arrows, move-quality badges) |
| `src/components/analysis` | Workspace (tabs: Review · Moves · Engine · Game), eval bar/graph, coach card, move list, engine lines |
| `src/components/account` | Header account button, avatar, guest and Google sign-in, picture picker |
| `src/components/providers` | Account (who is signed in, loading their data) and Settings providers |
| `src/components/import` | Chess.com username flow, PGN upload/paste |
| `src/lib/account` | Auth client (Better Auth), account state, the player's saved records (`docs.ts`: versioned, debounced, offline-tolerant) |
| `src/lib/api.ts` | API client: sign-in cookie, typed errors |
| `src/lib/storage` | Saved games, reviews and progress, on the server for every player (account or guest); an outbox for saves made offline |
| `src/lib/chess` | Types, PGN parsing/splitting, navigation reducer (single source of truth), line helpers, material, export |
| `src/lib/engine` | UCI parser, score normalisation (always White POV), `StockfishEngine` worker client, browser loader (multi/single-thread, auto threads/hash) |
| `src/lib/review` | Classification, accuracy, explanations, sacrifice detection, phases, clock timings, review orchestration + upgrades |
| `src/lib/coach.ts`, `src/lib/speech.ts` | Play-mode coach (grading, threats, hints) and the spoken coach |
| `src/lib/chesscom`, `src/lib/lichess` | Public API clients for game imports (allow-listed URLs, serial queue, retries, zod validation) |
| `src/lib/tablebase.ts` | Lichess 7-piece tablebase client and verdict formatting |
| `src/lib/learn/*` | Basics course, opening lines with move-by-move notes, tactic motifs |
| `src/lib/online` | Online games: `live.ts` (the game socket, with reconnects, ping and clock display) |
| `src/lib/share.ts`, `src/lib/boardImage.ts` | Share links (deflate + base64url in the URL fragment), PNG board export |
| `src/lib/url.ts` | Keeps on-screen state in the query string (`history.replaceState`) |
| `scripts/` | Engine copy, puzzle sampling, security-header generation, service worker, production preview server |

### Key flows

**Engine.** `getEngine()` creates one shared `StockfishEngine`. If the page is cross-origin isolated it starts
`stockfish-19-lite.js` with *Auto* threads (cores − 1, max 8; 2 on mobile) and a hash sized from
`navigator.deviceMemory`; otherwise or on failure it uses the single-threaded build. Only one search runs at a time;
a new `analyze()` stops the previous one. Scores are converted to White's point of view in one place.

**Review.** `runReview` analyses every position (preset depth + time cap, MultiPV 2), then `buildReview` (pure)
classifies, explains and summarises. Reviews store raw engine output, so rule changes bump `REVIEW_VERSION` and old
reviews are rebuilt without re-running the engine.

**Navigation.** `navReducer` holds `{ game, ply, variation }`. The imported game is immutable; exploring creates a
variation branching from a mainline ply.

**Saved data.** On start-up the AccountProvider asks the API who is here. For a player (a Google account or a guest)
it loads their records (settings, progress, lesson progress, …) into memory; pages read them instantly. A change updates memory at
once and is saved to the account 400 ms later with the version it was based on; a `409` means another device saved
first, so the app re-bases on the newer version and saves again. Games and reviews are written straight to the API.
Offline (bots and the coach still work), saves wait and are sent when the connection returns. A visitor's changes
stay in memory. Their first one opens a dialog (`src/components/account/SavePrompt.tsx`, once per page load) asking
whether to save as a guest or with Google; either way a session starts (`src/lib/account/guest.ts`; for Google, a
guest holds the data while they are away at Google, and signing in moves it into the account) and everything held in
memory is uploaded, so nothing done before that moment is lost. Closing the dialog keeps the changes in memory only. Nothing is written to browser storage; the session is a
cookie.

### Classification (summary)

Win% (Lichess logistic curve) from White-POV scores → mover's win% lost. Bands: Excellent < 2, Good < 5,
Inaccuracy < 10, Mistake < 20, Blunder ≥ 20; plus Best, Great (only good move), Brilliant (verified sacrifice),
Miss, Book, Forced. Details: `/about#method` and `src/lib/review/classify.ts`.

## The API

| Path | Responsibility |
| --- | --- |
| `server/src/index.ts` | Hono app: request ids, security headers, CORS allowlist, body limits, one error shape |
| `server/src/auth.ts` | Better Auth: Google, guest sessions (anonymous plugin), Tempo IDs, rate limits, cookies |
| `server/src/players.ts` | Tempo IDs and display-name rules |
| `server/src/routes/` | `me` (the signed-in player), `data` (saved records, games, reviews), `avatar` (Google photos and guests' DiceBear pictures, served from our domain) |
| `server/src/game/` | The online-game referee (`rules.ts`, pure and tested) and its Durable Objects |
| `server/src/db/schema.ts` | D1 schema (Drizzle); migrations in `server/migrations` |

### Accounts and saved data

- Sign-in is Google only (Better Auth), so Tempo stores no passwords and sends no email. Sessions are HTTP-only
  cookies shared by the app and the `api.` subdomain; a short-lived signed cookie copy avoids a database read on
  most requests.
- **Identity.** Every player has a display name (from Google, changeable, 2 to 24 characters, not unique) and a
  **Tempo ID** that we assign when the account is created: 7 characters from the game-code alphabet (about 27 billion
  possibilities), unique, never chosen and never changed, so players with the same name are told apart.
- **Guests** (Better Auth's anonymous plugin). A visitor becomes a guest only by picking a nickname and a
  DiceBear picture, when their first save asks or when they play online. A guest is a full player with a Tempo ID: they save
  and play like anyone else. Their session lasts 30 days and is renewed on use; a daily cron removes
  guests with no live session, with everything they saved. Signing in with Google from a guest session links the
  two (`onLinkAccount`): the guest's records, games, reviews and online games move to the account (where an existing
  account already has a record of the same kind, the account's copy wins), a brand-new account takes over the
  guest's Tempo ID, and the guest is deleted.
- Rate limits on Google sign-in and guest sign-in are counted per IP (`cf-connecting-ip`) in D1.
- Saved records are JSON documents with a version number; a save based on an old version is refused with `409` and
  the current copy. Games and reviews are rows keyed by player and game id, with size and count limits.

### Online games

**GameRoom**: one Durable Object per game, named by the game's code (6 characters from
`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, no look-alike characters such as I, L, O, 0 or 1), so the code is also the room's address.

| State | Meaning |
| --- | --- |
| `status` | `waiting` → `playing` → `ended` |
| `creator` | who made the game and shared its code |
| `players.w`, `players.b` | seated players; colours are drawn when the second player arrives |
| `fen`, `moves`, `sans` | the position and the moves so far |
| `clock`, `turnStartedAt` | each side's remaining time at the start of the turn, and when the turn began (server time) |
| `lagQuota` | per-player allowance for network delay |
| `drawOffer`, `result` | pending draw offer, and the final result and reason |

- **Clocks.** `used = now − turnStartedAt − forgivenLag`. Up to 500 ms of measured network delay is forgiven per
  move, from a 3-second allowance that refills slowly, so a slow connection is not flagged by lag but lag can't be
  used as thinking time. The increment is added after the move. White's clock starts after the first move; if White
  doesn't move within 30 seconds, the game is called off.
- **Flagging.** The room keeps one alarm, set to the moment the side to move runs out of time. When it fires, the
  room re-checks the clock and ends the game: a loss, or a draw if the opponent has no way to checkmate. No timers
  run in memory, so idle rooms sleep.
- **Connections.** Players connect over WebSocket, accepted with the hibernation API and tagged with the player and
  colour. Every (re)connect gets the full state, so a reload or a dropped connection simply resumes. The state tells
  each viewer whether they made the game or were invited to it (`relation`), because names are not unique.
- **Spectators.** Anyone with the game's link (`/play/game?code=K7F2QD`, the same address the players use) can follow it live, signed in or not.
  Spectator sockets are tagged as such: they receive every move, the clocks and the result, but any action they send
  is refused. Players see how many people are watching (`presence` carries a spectator count). Finished games stay
  watchable as a replay.
- **Protocol** (JSON, schema-checked, ≤ 1 KB, rate-limited per socket):

| Client → server | Server → client |
| --- | --- |
| `{t:"move", uci, ply}` | `{t:"state", …}` full snapshot (on connect) |
| `{t:"resign"}` | `{t:"move", uci, san, ply, clock, at}` |
| `{t:"draw", action:"offer"\|"accept"\|"decline"}` | `{t:"draw", by}` |
| `{t:"cancel"}` (before the game starts) | `{t:"end", result, reason, pgn}` |
| `{t:"ping", n}` | `{t:"pong", n}`, `{t:"presence", w, b, watching}`, `{t:"error", code, message}` |

A move whose `ply` is not the next one is ignored as a duplicate, and the sender gets a fresh `state`. When a game
ends, the room writes one row to D1 (players, time control, result, reason, PGN), once.

**Starting a game.**

`POST /api/v1/online` → `{ code, url }`. Share the code or the link (`/play/game?code=K7F2QD`); the first other
player (signed in or a guest) to join is seated, and anyone can type the code to watch. A game nobody joins expires
after 60 minutes.

**Not built yet**: quick pairing with strangers, ratings and leaderboards. Online games are casual.

## Running it

- App: `npm run dev` (http://localhost:3000). `NEXT_PUBLIC_API_URL` points at the API (default
  `http://localhost:8787`). The local preview's headers allow it; the committed host headers always name the
  deployed API (`scripts/headers.mjs`).
- API: `cd server && npm run dev` (http://localhost:8787 with a local D1). Tests sign players in with
  `server/scripts/test-player.mjs`, which writes a session into the local database only. See
  [Deployment](DEPLOYMENT.md) for production.
