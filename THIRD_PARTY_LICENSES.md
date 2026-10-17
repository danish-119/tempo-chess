# Third-party licenses

Tempo as a whole is distributed under the GNU General Public License v3.0 or later (see `LICENSE`).
It includes or depends on the following third-party components.

## Bundled / redistributed

| Component | Version | License | Use | Source |
| --- | --- | --- | --- | --- |
| Stockfish (via Stockfish.js) | 19 / npm `stockfish@19.0.1` | **GPL-3.0** | Chess engine (WASM lite builds, served from `/engine/`) | https://github.com/official-stockfish/Stockfish · https://github.com/nmrugg/stockfish.js |
| Stockfish NNUE network (lite) | embedded in the lite `.wasm` | distributed with Stockfish.js under GPL-3.0 | Engine evaluation | see Stockfish.js README (net credit: Chris Bao / sscg13) |
| Lichess "SFX" sound set (Move, Capture, Check, GenericNotify, Victory, Defeat, Draw) | lila master, Oct 2026 | **AGPL-3.0-or-later** | Sound effects (`public/sounds/sfx/`) | by Enigmahack — https://github.com/lichess-org/lila/tree/master/public/sound/sfx (see lila COPYING.md) |
| Lichess puzzle database (10,000-puzzle sample) | Oct 2026 | **CC0-1.0** | Practice puzzles (`src/data/puzzles.json`) | https://database.lichess.org/#puzzles (via huggingface.co/datasets/Lichess/chess-puzzles) |
| Piece set "cburnett" | lila master | GPL-2.0-or-later | `public/pieces/cburnett` | Colin M.L. Burnett — lichess-org/lila |
| Piece set "merida" | lila master | GPL-2.0-or-later | `public/pieces/merida` | Armando Hernandez Marroquin — lichess-org/lila |
| Piece set "chessnut" | lila master | Apache-2.0 | `public/pieces/chessnut` | Alexis Luengas — lichess-org/lila |
| Piece sets "fantasy", "spatial", "celtic" | lila master | MIT | `public/pieces/{fantasy,spatial,celtic}` | Maurizio Monge — lichess-org/lila |
| Piece set "rhosgfx" | lila master | CC0-1.0 | `public/pieces/rhosgfx` | RhosGFX — lichess-org/lila |
| Piece set "mpchess" | lila master | GPL-3.0-or-later | `public/pieces/mpchess` | Maxime Chupin — lichess-org/lila |
| Piece set "pixel" | lila master | AGPL-3.0-or-later | `public/pieces/pixel` | therealqtpi — lichess-org/lila |
| Bot avatars (DiceBear "Notionists", remix of Notionists by Zoish) | DiceBear 9.x | CC0-1.0 | `public/bots/*.svg` | https://www.dicebear.com/licenses/ |
| chess.js | 1.4.0 | BSD-2-Clause | Rules, move generation, PGN | https://github.com/jhlywa/chess.js |
| react-chessboard (incl. default piece SVGs) | 5.12.1 | MIT | Board UI | https://github.com/Clariity/react-chessboard |
| lichess-org/chess-openings | data snapshot, Oct 2026 | CC0-1.0 | Opening names/ECO (`src/data/openings.json`) | https://github.com/lichess-org/chess-openings |
| Next.js | 16.4.2 | MIT | Framework | https://github.com/vercel/next.js |
| React / React DOM | 19.3 | MIT | UI | https://github.com/facebook/react |
| Tailwind CSS | 4 | MIT | Styles | https://github.com/tailwindlabs/tailwindcss |
| lucide-react | 1.x | ISC | Icons | https://github.com/lucide-icons/lucide |
| idb | 8.0.4 | ISC | IndexedDB wrapper | https://github.com/jakearchibald/idb |
| zod | 4.x | MIT | Validation | https://github.com/colinhacks/zod |

## Stockfish GPL-3.0 compliance

- The engine binaries are **unmodified** builds from the `stockfish` npm package, version 19.0.1.
- The full GPL-3.0 text is served alongside the engine at `/engine/COPYING.txt` and is in `LICENSE`.
- Corresponding source: Stockfish.js 19.0.1 at https://github.com/nmrugg/stockfish.js (tag `v19.0.1`) and upstream Stockfish at https://github.com/official-stockfish/Stockfish.
- Tempo's own source must be made available to users of a public deployment (set `NEXT_PUBLIC_REPO_URL`).

## Original work

Tempo's logo, colour palette, move-class icons/colours and the fallback synthesised sounds are original to this project.

### Note on the AGPL sound files

The sound files are licensed AGPL-3.0-or-later. GPL-3.0 §13 permits combining GPL-3.0 code with AGPL-3.0 works; the sound files themselves remain under the AGPL. For a public deployment this means users must be able to obtain the source of the deployed site — which Tempo already requires for GPL compliance (set `NEXT_PUBLIC_REPO_URL`). To avoid the AGPL entirely, delete `public/sounds/sfx/`; Tempo then falls back to its own synthesised sounds. No Chess.com assets (palettes, piece sets, sounds or classification glyphs) are used.

## Algorithms credited

- Online services (not bundled, queried at runtime): Lichess endgame tablebase (`tablebase.lichess.ovh`, Syzygy tables) and Lichess opening explorer (`explorer.lichess.org`, Masters/Lichess game statistics), used under the Lichess API terms.
- Win-probability curve and per-move accuracy formula: published by Lichess at https://lichess.org/page/accuracy (mathematical formulas, re-implemented).
- Classification bands follow the expected-points ranges published by Chess.com's help centre; the implementation and Brilliant/Great/Miss rules are Tempo's own.
