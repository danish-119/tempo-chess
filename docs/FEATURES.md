# Features & limitations

## Implemented

**Play** — three modes: **Play with Bot** (10 bots from ≈400 to full-strength Stockfish: Ali, Sara, Omar use human-like move choice; Aisha … Hamza use UCI_Elo 1400–2600), **Play with Coach** (coach Danish, with a chosen rating) and **Play in Person**. White/Black/Random, optional clock for you only (1+0 … 30+0, loss on time; bots have no clock), Abort before your first move, an unfinished game is saved and can be resumed, history view (⏮ ◀ ▶ ⏭, arrow keys) separate from **Undo**, offer draw (accepted only if Stockfish isn't better), resign, rematch, copy/download PGN, "Review this game". **Coach mode**: eval bar, move-quality badge on your moved piece with explanation, "Undo & try again" after mistakes, two-step Hint (piece, then move), red threat arrows (null-move search), optional green best-move arrow.

**Review** — import by Chess.com or Lichess username (month archive, filters: time class, result, colour), Lichess game links (fetched directly), PGN upload (multi-game, drag & drop) or paste; Chess.com game links are recognised and explained. Automatic full review (Quick/Standard/Deep), classifications (Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder, Forced), Tempo accuracy (plus Chess.com's own figure when its API provides it), coach card per move, key-moment navigation, eval graph with time-per-move band, phase accuracy, time-pressure errors, opening name/ECO with ideas, retry any mistake, explore best lines as variations, live analysis with MultiPV, **7-piece endgame tablebase** (exact win/draw/loss, mate/DTZ distances and best moves, via Lichess), annotated PGN export, print report, FEN/moves/PGN copy.

**Practice** — choose Puzzles, Puzzle Rush, Endgames or Coordinates. Puzzles: 10,000 bundled Lichess puzzles (CC0), random each session, level (Beginner–Expert) and theme filters, hint, solution, retry, session streak. Puzzle Rush: 3 min, 5 min or Survival; difficulty ramps up, three mistakes end the run, best score per mode saved to your account, a list of every puzzle afterwards. Endgames: 18 key endgames (basic mates, pawn, rook, queen and minor-piece endings) played against perfect tablebase defence; a **Watch | Practice** switch: Practice flags any move that spoils the result (Take back / Hint); Watch shows the perfect line for both sides with ⏮ ◀ ▶ ⏭ and autoplay at 0.5–3 s per move. Coordinates: three modes — find the named square, name the highlighted square, or say whether a square is light or dark — in 30 s, 1 min, 2 min or untimed rounds, as White, Black or random, with optional on-board coordinates and an accuracy score.

**Learn** — Openings: 22 common openings (Italian, Ruy Lopez, Queen's Gambit, Sicilian, French, Caro-Kann, King's Indian, …) with ideas, step-through/autoplay, and a Practice mode where you play your side of the main line. Tactics: 27 motifs and mating patterns (fork, pin, skewer, discovered attack, deflection, back-rank, smothered, Anastasia's …) with real puzzle examples and a link to practise that theme. Glossary: 116 terms in 9 topics (rules, openings, strategy, tactics, endgames, notation, time controls & ratings, engine, review) with search and links to the matching lessons.

**Board editor** (Play → Set up a position) — set up any position (drag from the palettes or click to place, erase, side to move, castling rights, FEN in/out, legality checks), then Analyze it, Play from here against any bot or the coach, or (≤ 7 pieces) practise it against perfect defence. Copy a link to the position or download it as an image.

**Sharing** — every puzzle, endgame, opening and tactic has its own link (Copy link button; a shared puzzle link opens that exact puzzle). Copy share link packs the game (compressed PGN) into the link's #fragment, so nothing is uploaded; opening it imports the game. Board image downloads the current position as a PNG in your board colours and pieces. Press `?` for keyboard shortcuts. **Play in Person** — same-device games with flip / two equal boards / fixed views, optional clocks for both players, Undo, Draw and Resign (for the side to move), then Review this game.

**Play online** — create a game (1+0, 3+2, 5+0, 10+0, 15+10, 30+0 or no clock; White, Black or random) and send the 6-character code or the link; a friend types the code to join. The server checks every move, runs both clocks (with an allowance for network delay) and decides the result: checkmate, resignation, time, agreed draw, stalemate and the other draw rules. Anyone with the link can watch live, signed in or not, and players see how many are watching. Reconnecting after a dropped connection resumes the game. Type any game's code to join it or watch it. No account needed: a guest picks a nickname (2 to 24 characters, need not be unique) and a DiceBear picture, and plays like anyone else.

**Accounts and guests** — sign in with Google; there are no passwords. Every player has a Tempo ID we assign (7 characters, such as #4K7F2QD, unique and permanent) and a display name they can change (it need not be unique), with their Google photo, a DiceBear picture or a coloured letter. Games, reviews, progress, Basics progress, Puzzle Rush best scores, an unfinished Play game and settings are saved on the server. A visitor who saves anything (a finished lesson, a setting, a game) quietly becomes a guest: the same saving, kept while they come back at least once every 30 days on that browser; clearing the browser's data starts them over. Signing in with Google moves everything into the account, and a new account keeps the guest's ID. Change your name, or swap your Google photo for a DiceBear picture, and delete your whole account from the account page. Offline, bots and the coach keep working and saves are sent when the connection returns.

**Appearance** — 8 board colour themes and 10 piece sets; settings open in a modal.

**Navigation** — header tabs Play · Review · Practice · Learn · Progress (the editor opens from Play); the address bar reflects what is on screen (review source/user/month, analysis move and panel, practice mode and filters, editor position), so Back and reload restore it; an unfinished Play game is saved to your account and can be resumed.

**General** — light/dark themes, sounds (Lichess SFX, AGPL), glossary hints and Learn page, keyboard navigation, a phone layout with a bottom tab bar, one-screen desktop layout, installable PWA that works offline after the first visit.

## Intentionally not included

- Server-side engine analysis: Stockfish runs in the browser, which is free and fast enough.
- AI/LLM explanations (deterministic rules only).

## Not built yet

- Quick pairing with strangers by rating, online ratings and leaderboards. See [online games](ARCHITECTURE.md#online-games).

## Known limitations

- Classifications/accuracy are approximations that depend on engine depth; other tools may grade the same move differently.
- Lite Stockfish is weaker than full Stockfish 19 (still far above human strength); Quick reviews may misjudge sharp tactics.
- Chess.com's API has no single-game endpoint; just-finished games can take a while to appear in archives.
- Tactic naming covers forks, pins, hanging pieces, promotion, (back-rank) mates and missed material; other motifs fall back to neutral wording.
- Only standard chess (no Chess960 or other variants).
