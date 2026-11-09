import { execFileSync, execSync } from "node:child_process";
import { join } from "node:path";
import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Helpers for the browser tests that use the real local API (server/, `npm run dev`).
 *
 * Sign-in is Google only, which a test cannot click through, so a signed-in player is made directly in the local
 * development database and given a session cookie (see server/scripts/test-player.mjs). This touches only the
 * local database (`--local`), never a deployed one, and the API has no test-only code.
 */
export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const SERVER = join(__dirname, "..", "..", "server");

export async function apiUp(): Promise<boolean> {
  try {
    return (await fetch(`${API}/health`)).ok;
  } catch {
    return false;
  }
}

/** Guest sign-ins are rate-limited per IP, and the suite makes several from one machine. */
export function clearRateLimits(): void {
  try {
    execSync('npx wrangler d1 execute tempo --local --command "DELETE FROM rate_limit"', {
      cwd: SERVER,
      stdio: "ignore",
      timeout: 60_000,
    });
  } catch {
    /* if this fails, the guest tests will say so */
  }
}

export interface SignedIn {
  page: Page;
  name: string;
  tag: string;
}

/** A fresh signed-in player (name like "Anna123456") in their own browser. */
export async function signedInPlayer(browser: Browser, prefix: string): Promise<SignedIn> {
  const name = `${prefix}${`${Date.now()}`.slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  const out = execFileSync(process.execPath, [join(SERVER, "scripts", "test-player.mjs"), name], { cwd: SERVER, encoding: "utf8", timeout: 60_000 });
  const p = JSON.parse(out.trim().split(/\r?\n/).pop()!) as { tag: string; cookie: { name: string; value: string } };
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: p.cookie.name, value: p.cookie.value, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  await page.goto("/account");
  await expect(page.getByRole("button", { name: `Account: ${name}` })).toBeVisible();
  return { page, name, tag: p.tag };
}

/** Become a guest on a page that shows the guest form (Play online, or a game link). */
export async function playAsGuest(page: Page, nickname: string): Promise<void> {
  await page.getByLabel("Your nickname").fill(nickname);
  await page.getByRole("radio", { name: "Picture 3" }).click();
  await page.getByRole("button", { name: /^(Play|Save) as a guest$/ }).click();
}
