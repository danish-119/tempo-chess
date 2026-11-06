// Builds out/sw.js from scripts/sw.template.js with a precache list of every
// file in out/. Runs after `next build` (npm "postbuild").
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const hash = createHash("sha1");
const urls = new Set();
for (const file of walk(out).sort()) {
  const rel = relative(out, file).split("\\").join("/");
  if (rel === "sw.js" || rel.endsWith(".map") || rel === "404.html" || rel === "_headers") continue;
  hash.update(rel).update(readFileSync(file));
  if (rel === "index.html") urls.add("/");
  else if (rel.endsWith("/index.html")) urls.add(`/${rel.slice(0, -"index.html".length)}`);
  else if (rel.endsWith(".html")) urls.add(`/${rel.slice(0, -".html".length)}`);
  else urls.add(`/${rel}`);
}

const list = [...urls].sort().map((u) => encodeURI(u));
const version = hash.digest("hex").slice(0, 12);
const template = readFileSync(join(root, "scripts", "sw.template.js"), "utf8");
writeFileSync(join(out, "sw.js"), template.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(list)));
console.log(`Wrote out/sw.js (${list.length} precached files, version ${version})`);
