// Builds src/data/puzzles.json: ~10,000 puzzles sampled at random from the
// Lichess puzzle database (CC0, https://database.lichess.org/#puzzles) via
// the Hugging Face mirror "Lichess/chess-puzzles".
//
// Quality filter: Popularity ≥ 80, NbPlays ≥ 100, RatingDeviation ≤ 100.
// Stratified into 12 rating bands (400–2800+) so every level is represented;
// rare high bands are topped up from others after a while.
// Progress is saved every 20 requests. Run: node scripts/build-puzzles.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "src", "data", "puzzles.json");
const API = "https://datasets-server.huggingface.co/rows?dataset=Lichess/chess-puzzles&config=default&split=train";
const TOTAL_ROWS = 6157341;
const TARGET = 10000;
const BANDS = [400, 700, 900, 1100, 1300, 1500, 1700, 1900, 2100, 2300, 2500, 2700, 3400];
const PER_BAND = Math.ceil(TARGET / (BANDS.length - 1));
const DROP_THEMES = new Set(["short", "long", "veryLong", "oneMove", "master", "masterVsMaster", "superGM"]);

const band = (r) => BANDS.findIndex((b, i) => r >= b && r < BANDS[i + 1]);
const buckets = Array.from({ length: BANDS.length - 1 }, () => new Map());
const total = () => buckets.reduce((a, b) => a + b.size, 0);
// Uniqueness: by puzzle id (Map keys) and by starting position.
const seenFens = new Set();

// Resume: keep puzzles from a previous (partial) run.
if (existsSync(OUT)) {
  for (const p of JSON.parse(readFileSync(OUT, "utf8"))) {
    const i = band(p.rating);
    if (i >= 0 && !seenFens.has(p.fen)) {
      buckets[i].set(p.id, p);
      seenFens.add(p.fen);
    }
  }
  console.log(`Resuming with ${total()} puzzles`);
}

function save() {
  const puzzles = buckets.flatMap((b) => [...b.values()]).sort((a, b) => a.rating - b.rating);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(puzzles));
  return puzzles.length;
}

async function fetchPage(offset) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API}&offset=${offset}&length=100`, { signal: AbortSignal.timeout(30_000) });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).rows.map((r) => r.row);
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return [];
}

let requests = 0;
while (total() < TARGET && requests < 4000) {
  const offsets = Array.from({ length: 4 }, () => Math.floor(Math.random() * (TOTAL_ROWS - 100)));
  const pages = await Promise.all(offsets.map((o) => fetchPage(o).catch(() => [])));
  requests += pages.length;
  const relaxed = requests > 200;
  for (const p of pages.flat()) {
    if (p.Popularity < 80 || p.NbPlays < 100 || p.RatingDeviation > 100) continue;
    const i = band(p.Rating);
    if (i < 0 || seenFens.has(p.FEN) || (!relaxed && buckets[i].size >= PER_BAND) || total() >= TARGET) continue;
    seenFens.add(p.FEN);
    buckets[i].set(p.PuzzleId, {
      id: p.PuzzleId,
      fen: p.FEN,
      moves: p.Moves,
      rating: p.Rating,
      themes: (p.Themes ?? []).filter((t) => !DROP_THEMES.has(t)),
    });
  }
  if (requests % 20 === 0) {
    save();
    console.log(`requests ${requests} · bands ${buckets.map((b) => b.size).join("/")} · total ${total()}`);
  }
}
console.log(`Wrote ${save()} puzzles to src/data/puzzles.json after ${requests} requests`);
