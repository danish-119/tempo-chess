# Architecture

Tempo is a **static, client-only** Next.js (App Router) application. `next build` produces `out/` (HTML/JS/CSS + engine + sounds); there is no server code in production.

```
Browser
 ├─ React UI (src/app, src/components)
 │    └─ hooks: useEngine · useLiveAnalysis · useReview · useSound
 ├─ Web Worker: Stockfish 19 lite (WASM)  ← /engine/*.js|.wasm
 ├─ IndexedDB (games, reviews, Chess.com cache)
 ├─ fetch → https://api.chess.com/pub/... · https://lichess.org/api/... (imports)
 ├─ fetch → https://tablebase.lichess.ovh (≤ 7 pieces, analysis)
 └─ fetch → https://explorer.lichess.org (explorer, only after the optional Lichess login)
```

## Directory map

| Path | Responsibility |
| --- | --- |
| `src/app/*` | Routes: `/` landing, `/play`, `/review` (import), `/analyze`, `/editor`, `/practice` (Puzzles · Puzzle Rush · Endgames · Coordinates), `/learn` (Openings · Tactics · Glossary), `/auth/lichess` (OAuth callback), `/learn`, `/about` (Settings is a modal), `/privacy`, `/terms` |
| `src/components/board` | Board wrapper (click/drag moves, promotion dialog, highlights, arrows, move-quality badges) |
| `src/components/analysis` | Workspace (tabs: Review · Moves · Engine · Game), eval bar/graph, coach card, move list, engine lines |
| `src/components/import` | Chess.com username flow, PGN upload/paste |
| `src/lib/chess` | Types, PGN parsing/splitting, navigation reducer (single source of truth), line helpers, material, export |
| `src/lib/engine` | UCI parser, score normalisation (always White POV), `StockfishEngine` worker client, browser loader (multi/single-thread, auto threads/hash) |
| `src/lib/review` | Classification, accuracy, explanations, sacrifice detection, phases, clock timings, review orchestration + upgrades |
| `src/lib/coach.ts` | Play-mode coach: grading, threats (null-move search), hints |
| `src/lib/chesscom` | Published-Data API client (allow-listed URL, serial queue, retries, cache, zod validation) |
| `src/lib/lichess` | Lichess public API client (same safeguards; users' monthly games as NDJSON, single games by link), optional OAuth PKCE login (`auth.ts`), opening explorer client (`explorer.ts`) |
| `src/lib/tablebase.ts` | Lichess 7-piece tablebase client and verdict formatting |
| `src/lib/rush.ts` | Puzzle Rush difficulty ramp, puzzle choice, best scores |
| `src/lib/chess/editor.ts` | Board editor: placement ↔ FEN, castling rights, legality checks |
| `src/lib/endgames.ts` | Endgame trainer lessons and result judging |
| `src/lib/learn/*` | Opening lines and tactic motifs for Learn |
| `src/lib/share.ts`, `src/lib/boardImage.ts` | Share links (deflate + base64url in the URL fragment), PNG board export |
| `src/lib/url.ts` | Keeps on-screen state in the query string (`history.replaceState`) |
| `src/lib/openings` | Lazy-loaded CC0 opening table (EPD → ECO/name), book policy |
| `src/lib/storage` | IndexedDB with in-memory fallback, typed errors |
| `src/lib/puzzles.ts` | Practice puzzles: loading, filtering, random pick, move checking |
| `src/lib/appearance.ts` | Board themes and piece sets |
| `scripts/` | Engine copy, puzzle sampling, header generation, production preview server |

## Key flows

**Engine.** `getEngine()` creates one shared `StockfishEngine`. If the page is cross-origin isolated it starts `stockfish-19-lite.js` with *Auto* threads (cores − 1, max 8; 2 on mobile) and a hash sized from `navigator.deviceMemory`; otherwise or on failure it uses the single-threaded build. Only one search runs at a time; a new `analyze()` stops the previous one (which resolves with `stopped: true`). Scores are converted to White's point of view in one place.

**Review.** `runReview` analyses every position (preset depth + time cap, MultiPV 2), then `buildReview` (pure) classifies, explains and summarises. Reviews store raw engine output (`positions`), so rule changes bump `REVIEW_VERSION` and old reviews are rebuilt instantly without re-running the engine. After a review, mainline positions are shown from stored data; live search runs only for variations or "Analyze deeper".

**Navigation.** `navReducer` holds `{ game, ply, variation }`. The imported game is immutable; exploring creates a variation branching from a mainline ply.

**Live analysis.** Debounced per position, paused when the tab is hidden, and the UI only updates on complete, same-depth MultiPV iterations (≥ depth 10, ≤ 2 updates/s) to avoid flicker.

## Classification (summary)

Win% (Lichess logistic curve) from White-POV scores → mover's win% lost. Bands: Excellent < 2, Good < 5, Inaccuracy < 10, Mistake < 20, Blunder ≥ 20; plus Best, Great (only good move), Brilliant (verified sacrifice), Miss, Book, Forced. Details: `/about#method` and `src/lib/review/classify.ts`.
