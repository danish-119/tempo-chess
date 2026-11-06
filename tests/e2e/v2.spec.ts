import { expect, test } from "@playwright/test";

// Local WebRTC between two headless browsers: show real IPs so no mDNS lookup is needed.
test.use({ launchOptions: { args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] } });

test.describe("Tempo v2", () => {
  test("two players connect with a link and a reply code, and moves travel both ways", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    await host.goto("/play");
    await host.getByRole("radio", { name: "Play a friend online" }).click();
    // The radio inputs are visually hidden behind their tiles (as on the Play page), so select them directly.
    await host.getByRole("radio", { name: "White" }).check({ force: true });
    await host.getByRole("radio", { name: /^5 min/ }).check({ force: true });
    await host.getByRole("switch", { name: /public STUN/ }).click(); // same machine: no STUN needed
    await host.getByRole("button", { name: "Create invite link" }).click();
    const link = await host.getByLabel("Invite link", { exact: true }).inputValue();
    expect(link).toMatch(/\/play#o=d\./);

    await guest.goto(link);
    const reply = guest.getByLabel("Your reply code");
    await expect(reply).not.toHaveValue("");
    await host.getByLabel("Reply code from your friend").fill(await reply.inputValue());
    await host.getByRole("button", { name: "Connect" }).click();

    await expect(host.getByText("You play White")).toBeVisible();
    await expect(guest.getByText("You play Black")).toBeVisible();
    await expect(host.getByText("Your move")).toBeVisible();

    // The 5-minute clocks are shown to both players and White's is running.
    await expect(host.getByRole("timer", { name: "Your clock" })).toHaveText(/^(4:5\d|5:00)$/);
    await expect(guest.getByRole("timer", { name: "Friend's clock" })).toHaveText(/^(4:5\d|5:00)$/);

    // White plays e4 by clicking squares.
    await host.locator('[data-square="e2"]').first().click();
    await host.locator('[data-square="e4"]').first().click();
    await expect(guest.getByRole("list", { name: "Moves" })).toContainText("1. e4");
    await expect(guest.getByText("Your move")).toBeVisible();

    // Black answers e5.
    await guest.locator('[data-square="e7"]').first().click();
    await guest.locator('[data-square="e5"]').first().click();
    await expect(host.getByRole("list", { name: "Moves" })).toContainText("1. e4 e5");

    // Resign ends the game for both.
    await guest.getByRole("button", { name: "Resign" }).click();
    await expect(host.getByText("Your opponent resigned. You win!").first()).toBeVisible();
    await expect(guest.getByText("You resigned.").first()).toBeVisible();

    await hostCtx.close();
    await guestCtx.close();
  });

  test("online play is a fourth mode card on Play and never flashes an error", async ({ page }) => {
    // The prerendered page must not contain the unsupported-browser error (it used to flash before hydration).
    const html = await (await page.request.get("/play")).text();
    expect(html).not.toContain("Peer-to-peer isn");
    await page.goto("/play");
    await expect(page.getByRole("radio", { name: "Play with Coach" })).toBeVisible();
    await page.getByRole("radio", { name: "Play a friend online" }).click();
    await expect(page.getByRole("button", { name: "Create invite link" })).toBeVisible();
    await expect(page.getByText(/isn't available/)).toHaveCount(0);
    // Switching back restores the normal setup.
    await page.getByRole("radio", { name: "Play with Coach" }).click();
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  });

  test("an invalid invite link is rejected clearly and the page is usable afterwards", async ({ page }) => {
    await page.goto("/play#o=d.notacode");
    await expect(page.getByText(/isn't valid or has expired/)).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute("data-join", /.*/);
    await expect(page.getByRole("button", { name: "Create invite link" })).toBeVisible();
  });

  test("the old /play/online address forwards to Play", async ({ page }) => {
    await page.goto("/play/online#o=d.notacode");
    await page.waitForURL(/\/play#o=d\.notacode/);
    await expect(page.getByText(/isn't valid or has expired/)).toBeVisible();
  });

  test("blindfold: type a move and the bot answers with the board hidden", async ({ page }) => {
    await page.goto("/practice?mode=blindfold");
    await page.getByRole("button", { name: "Start blindfold game" }).click();
    const input = page.getByLabel("Your move", { exact: true });
    await input.fill("e4");
    await input.press("Enter");
    await expect(page.getByRole("list", { name: "Move list" })).toContainText(/1\. e4 \S+/, { timeout: 60_000 });
    await expect(page.getByText("The pieces are hidden.")).toBeVisible();
    await input.fill("Qh8");
    await input.press("Enter");
    await expect(page.getByText(/not a legal move/)).toBeVisible();
  });

  test("watch two engines play each other, with a choice of strengths and pause", async ({ page }) => {
    await page.goto("/play");
    await page.getByRole("radio", { name: "Watch engines" }).click();
    // Only one card is selected at a time.
    await expect(page.getByRole("radio", { name: "Watch engines" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Play with Coach" })).not.toBeChecked();
    await expect(page.getByRole("radio", { name: "Play a friend online" })).not.toBeChecked();
    // Both sides default to full strength, and the pause between moves defaults to 5 seconds.
    await expect(page.getByRole("radiogroup", { name: "White engine" }).getByRole("radio", { checked: true })).toContainText("Max");
    await expect(page.getByRole("radiogroup", { name: "Black engine" }).getByRole("radio", { checked: true })).toContainText("Max");
    await expect(page.getByRole("radiogroup", { name: "Pause between moves" }).getByRole("radio", { name: "5 s" })).toBeChecked();
    // Pick a weaker Black and no pause so the test is quick.
    await page.getByRole("radiogroup", { name: "Black engine" }).getByRole("radio", { name: /Ali/ }).click();
    await page.getByRole("radiogroup", { name: "Pause between moves" }).getByRole("radio", { name: "Off" }).click();
    await expect(page.getByRole("switch", { name: "Vary the opening" })).toBeChecked();
    await expect(page.getByRole("switch", { name: "Show evaluation bar" })).toBeChecked();
    await page.getByRole("button", { name: "Start match" }).click();
    // The match takes over the screen like the other games: the mode cards are gone until you go back.
    await expect(page.getByRole("radio", { name: "Play with Coach" })).toHaveCount(0);

    const moves = page.getByRole("list", { name: "Moves" });
    await expect(moves).toContainText(/1\. \S+ \S+/, { timeout: 90_000 });

    // Pause stops the game; Resume continues it.
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByText("Paused")).toBeVisible();
    await page.waitForTimeout(800);
    const frozen = await moves.innerText();
    await page.waitForTimeout(4000);
    expect(await moves.innerText()).toBe(frozen);
    await page.getByRole("button", { name: "Resume" }).click();
    await expect.poll(async () => (await moves.innerText()).length, { timeout: 60_000 }).toBeGreaterThan(frozen.length);

    // The pause can be changed live, and the game can be handed over for review.
    await page.getByLabel("Pause between moves").selectOption("2");
    await expect(page.getByLabel("Pause between moves")).toHaveValue("2");
    await expect(page.getByRole("button", { name: "Review this game" })).toBeEnabled();

    // The evaluation bar can be hidden (and shown again) during the match.
    await expect(page.getByRole("meter")).toBeVisible();
    await page.getByRole("switch", { name: "Show evaluation bar" }).click();
    await expect(page.getByRole("meter")).toHaveCount(0);
    await page.getByRole("switch", { name: "Show evaluation bar" }).click();
    await expect(page.getByRole("meter")).toBeVisible();

    // Back leaves the match and returns to the setup, like the other games.
    await page.goBack();
    await expect(page.getByRole("button", { name: "Start match" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Play with Coach" })).toBeVisible();
  });

  test("the evaluation bar can be hidden in Play with Coach, and the choice is remembered", async ({ page }) => {
    await page.goto("/play");
    await page.getByRole("radio", { name: "Play with Coach" }).click();
    const bar = page.getByRole("switch", { name: "Show evaluation bar" });
    await expect(bar).toBeChecked();
    await bar.click(); // hide it
    await expect(bar).not.toBeChecked();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("meter")).toHaveCount(0);
    // The choice is a setting, so it carries over to the engine match as well.
    await page.goto("/play");
    await page.getByRole("radio", { name: "Watch engines" }).click();
    await expect(page.getByRole("switch", { name: "Show evaluation bar" })).not.toBeChecked();
  });

  test("captured pieces and the material lead are shown next to each player", async ({ page }) => {
    await page.goto("/play");
    await page.getByRole("radio", { name: /Play in Person/ }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("img", { name: "White has captured nothing yet." })).toBeVisible();
    await expect(page.getByRole("img", { name: "Black has captured nothing yet." })).toBeVisible();

    // 1. e4 d5 2. exd5: White wins a pawn and leads by one point.
    for (const sq of ["e2", "e4", "d7", "d5", "e4", "d5"]) await page.locator(`[data-square="${sq}"]`).click();
    await expect(page.getByRole("img", { name: "Captured by White: 1 pawn. White is ahead by 1 point." })).toBeVisible();
    await expect(page.getByText("+1", { exact: true })).toBeVisible();

    // 2... Qxd5: material is level again and each side has taken one pawn, so no "+" is shown.
    await page.locator('[data-square="d8"]').click();
    await page.locator('[data-square="d5"]').click();
    await expect(page.getByRole("img", { name: "Captured by Black: 1 pawn." })).toBeVisible();
    await expect(page.getByRole("img", { name: "Captured by White: 1 pawn." })).toBeVisible();
    await expect(page.getByText("+1", { exact: true })).toHaveCount(0);
  });

  test("colour-blind palette and spoken-coach settings", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("switch", { name: "Colour-blind-safe move colours" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-cb", "on");
    await expect(page.getByRole("switch", { name: "Coach speaks its feedback aloud" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Announce moves to screen readers" })).toBeVisible();
  });

  test("progress page shows an empty state, then the streak after practice", async ({ page }) => {
    await page.goto("/progress");
    await expect(page.getByText("Your journey starts today")).toBeVisible();
    await page.goto("/practice?mode=blindfold");
    await page.getByRole("button", { name: "Start blindfold game" }).click();
    await page.getByRole("button", { name: "Resign" }).click(); // finishing a game counts as today's activity
    await expect(page.getByText("Game over")).toBeVisible();
    await page.goto("/progress");
    await expect(page.getByText("1 day", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Active days")).toBeVisible();
  });

  test("keeps working offline after the first visit (installable PWA)", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect
      .poll(async () => page.evaluate(async () => {
        const keys = await caches.keys();
        return keys.length ? (await (await caches.open(keys[0])).keys()).length : 0;
      }), { timeout: 60_000 })
      .toBeGreaterThan(200);
    await page.reload(); // now controlled by the service worker
    await context.setOffline(true);
    await page.goto("/progress");
    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
    await page.goto("/practice?mode=blindfold");
    await expect(page.getByRole("button", { name: "Start blindfold game" })).toBeVisible();
    await expect(page.getByText(/Offline/)).toBeVisible();
    const manifest = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute("href"));
    expect(manifest).toBe("/manifest.webmanifest");
    await context.setOffline(false);
  });
});
