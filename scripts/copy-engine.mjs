// Copies the verified Stockfish.js lite builds from node_modules/stockfish
// into public/engine so they are served as static assets next to each other
// (each .js worker loads the .wasm with the same base name).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules", "stockfish");
const binDir = join(pkgDir, "bin");
const outDir = join(root, "public", "engine");

const FILES = [
  "stockfish-19-lite-single.js",
  "stockfish-19-lite-single.wasm",
  "stockfish-19-lite.js",
  "stockfish-19-lite.wasm",
];

if (!existsSync(binDir)) {
  console.error("[copy-engine] node_modules/stockfish/bin not found. Run `npm install` first.");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
for (const f of FILES) {
  const src = join(binDir, f);
  if (!existsSync(src)) {
    console.error(`[copy-engine] Missing engine file: ${f}`);
    process.exit(1);
  }
  copyFileSync(src, join(outDir, f));
}
copyFileSync(join(pkgDir, "Copying.txt"), join(outDir, "COPYING.txt"));
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
writeFileSync(
  join(outDir, "engine.json"),
  JSON.stringify(
    {
      package: "stockfish",
      version: pkg.version,
      license: pkg.license,
      source: "https://github.com/nmrugg/stockfish.js",
      upstream: "https://github.com/official-stockfish/Stockfish",
      files: FILES,
    },
    null,
    2,
  ),
);
console.log(`[copy-engine] Stockfish.js ${pkg.version} (${pkg.license}) copied to public/engine`);
