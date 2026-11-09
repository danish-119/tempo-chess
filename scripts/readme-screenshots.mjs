// Retakes the README screenshots (docs/screenshots/*.png, 1440×900, dark theme) from a running build.
// Needs the app on http://localhost:4173 (npm start) and the API on :8787 (cd server && npm run dev).
// Usage: node scripts/readme-screenshots.mjs   (ONLY=import,basics for just some)
import { chromium } from "@playwright/test";
import { testPlayer } from "../server/scripts/test-player.mjs";

const APP = process.env.APP ?? "http://localhost:4173";
const OUT = "docs/screenshots";
const VIEW = { width: 1440, height: 900 };

const OPERA = `[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

const browser = await chromium.launch();
const fresh = async () => {
  const ctx = await browser.newContext({ viewport: VIEW, colorScheme: "dark", deviceScaleFactor: 1 });
  return { ctx, page: await ctx.newPage() };
};
// ONLY=import,basics retakes just those shots.
const ONLY = process.env.ONLY?.split(",");
const want = (name) => !ONLY || ONLY.includes(name);
const shot = async (page, name) => {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("saved", name);
};

// 1. A reviewed game: the Opera Game, at Morphy's queen sacrifice.
if (want("review")) {
  const { ctx, page } = await fresh();
  await page.goto(`${APP}/review`);
  await page.getByRole("tab", { name: /Paste PGN/ }).click();
  await page.getByRole("textbox").first().fill(OPERA);
  await page.getByRole("button", { name: "Load game" }).click();
  await page.getByRole("button", { name: /Next key moment/ }).waitFor({ timeout: 240_000 });
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /Next key moment/ }).click();
  await shot(page, "review");
  await ctx.close();
}

// 2. Importing a Chess.com player's games.
if (want("import")) {
  const { ctx, page } = await fresh();
  await page.goto(`${APP}/review`);
  await page.getByRole("textbox").first().fill("danish-119");
  // Chess.com is sometimes slow to answer, so ask again a few times before giving up.
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByRole("button", { name: "Find games" }).click();
    // Wait until the month's games have arrived from Chess.com.
    await page.getByRole("button", { name: "Find games" }).and(page.locator(":not([aria-busy=true])")).waitFor({ timeout: 30_000 });
    await page.waitForFunction(() => !document.querySelector("button[aria-busy=true], [role=status] svg.animate-spin"), null, { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    if (!(await page.getByText("Couldn't load games").isVisible())) break;
    console.log("Chess.com did not answer, trying again");
    await page.waitForTimeout(3000);
  }
  await shot(page, "import");
  await ctx.close();
}

// 3. A game against the coach, a few moves in.
if (want("play")) {
  const { ctx, page } = await fresh();
  await page.goto(`${APP}/play?mode=coach`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const move = async (from, to) => {
    await page.locator(`[data-square="${from}"]`).first().click();
    await page.locator(`[data-square="${to}"]`).first().click();
    await page.waitForTimeout(4000);
  };
  await move("e2", "e4");
  await move("g1", "f3");
  await move("f1", "c4");
  await shot(page, "play");
  await ctx.close();
}

// 4. Puzzles: choosing a level and a theme.
if (want("puzzles")) {
  const { ctx, page } = await fresh();
  await page.goto(`${APP}/practice?mode=puzzles`);
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: /^Fork/ }).click();
  await page.mouse.move(0, 0);
  await shot(page, "puzzles");
  await ctx.close();
}

// 5. Endgames.
if (want("endgames")) {
  const { ctx, page } = await fresh();
  await page.goto(`${APP}/practice?mode=endgames`);
  await shot(page, "endgames");
  await ctx.close();
}

// 6. Learn the basics: the lesson path.
if (want("basics")) {
  const { ctx, page } = await fresh();
  await page.goto(`${APP}/learn/basics`);
  await shot(page, "basics");
  await ctx.close();
}

// 7. Play a friend online: the code to share, as a signed-in player.
if (want("online")) {
  const p = await testPlayer(`Magnus${`${Date.now()}`.slice(-6)}`);
  const { ctx, page } = await fresh();
  await ctx.addCookies([{ name: p.cookie.name, value: p.cookie.value, domain: "localhost", path: "/" }]);
  await page.goto(`${APP}/play?mode=online`);
  await page.getByRole("radio", { name: "10 min" }).click();
  await page.getByRole("button", { name: "Create a game" }).click();
  await page.getByRole("heading", { name: "Send this code to your friend" }).waitFor({ timeout: 20_000 });
  await shot(page, "online");
  await ctx.close();
}

await browser.close();
