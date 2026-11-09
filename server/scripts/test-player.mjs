// A signed-in player for tests and screenshots, made directly in the LOCAL development database.
//
// Sign-in is Google only, which an automated test cannot click through, so this writes a user and a session row
// with `wrangler d1 execute --local` and signs the session cookie with the local secret from server/.dev.vars,
// exactly as Better Auth does. It never touches a deployed database (`--local`), and the API has no test-only code.
import { execSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = join(dirname(fileURLToPath(import.meta.url)), "..");
/** The session cookie's name in development (`cookiePrefix: "tempo"`; production adds the `__Secure-` prefix). */
export const SESSION_COOKIE = "tempo.session_token";

function localSecret() {
  const vars = readFileSync(join(SERVER, ".dev.vars"), "utf8");
  const m = vars.match(/^BETTER_AUTH_SECRET\s*=\s*"?([^"\r\n]+)"?/m);
  if (!m) throw new Error("BETTER_AUTH_SECRET is missing from server/.dev.vars");
  return m[1];
}

/** Better Auth's signed cookie value: `token.base64(HMAC-SHA256(secret, token))`, URL-encoded. */
async function sign(token, secret) {
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)));
  return encodeURIComponent(`${token}.${btoa(String.fromCharCode(...mac))}`);
}

/** Run SQL against the local database. */
export function localSql(sql) {
  execSync(`npx wrangler d1 execute tempo --local --command "${sql}"`, { cwd: SERVER, stdio: "ignore", timeout: 60_000 });
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newTag = () => Array.from(webcrypto.getRandomValues(new Uint8Array(7)), (b) => ALPHABET[b % ALPHABET.length]).join("");

/**
 * A new signed-in player with this display name (letters and digits only, for simple SQL), and a fresh Tempo ID.
 * Returns their id, tag and the session cookie to send (`Cookie: name=value`) or to add to a browser.
 */
export async function testPlayer(name) {
  if (!/^[a-zA-Z][a-zA-Z0-9]{1,23}$/.test(name)) throw new Error(`not a valid test name: ${name}`);
  const id = webcrypto.randomUUID();
  const tag = newTag();
  const token = Array.from(webcrypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const email = `${name.toLowerCase()}-${tag.toLowerCase()}@example.com`;
  localSql(
    `INSERT INTO user (id, name, email, email_verified, image, tag, is_anonymous, created_at, updated_at) VALUES ('${id}', '${name}', '${email}', 1, NULL, '${tag}', 0, ${now}, ${now}); ` +
      `INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES ('${webcrypto.randomUUID()}', ${now + 7 * 864e5}, '${token}', ${now}, ${now}, '${id}');`,
  );
  return { id, name, tag, email, cookie: { name: SESSION_COOKIE, value: await sign(token, localSecret()) } };
}

// From the command line (used by the browser tests): `node scripts/test-player.mjs Anna123` prints the player as JSON.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(await testPlayer(process.argv[2])));
}
