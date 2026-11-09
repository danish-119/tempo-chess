import { expect, test } from "./fixtures";

test.describe("Tempo v2", () => {
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
    await expect(page.getByRole("radio", { name: "Play the computer" })).not.toBeChecked();
    await expect(page.getByRole("radio", { name: "Play online" })).not.toBeChecked();
    // Both sides default to full strength, and the pause between moves defaults to 5 seconds.
    await expect(page.getByRole("radiogroup", { name: "White engine" }).getByRole("radio", { checked: true })).toContainText("Max");
    await expect(page.getByRole("radiogroup", { name: "Black engine" }).getByRole("radio", { checked: true })).toContainText("Max");
    await expect(page.getByRole("radiogroup", { name: "Pause between moves" }).getByRole("radio", { name: "5 s" })).toBeChecked();
    // Pick a weaker Black and no pause so the test is quick.
    await page.getByRole("radiogroup", { name: "Black engine" }).getByRole("radio", { name: /Ali/ }).click();
    await page.getByRole("radiogroup", { name: "Pause between moves" }).getByRole("radio", { name: "Off" }).click();
    await expect(page.getByRole("switch", { name: "Vary the opening" })).toBeChecked();
    // The evaluation bar is not offered here any more: it is in Settings, and in the match itself.
    await expect(page.getByRole("switch", { name: /evaluation bar/i })).toHaveCount(0);
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
    await expect(page.getByRole("radio", { name: "Play the computer" })).toBeVisible();
  });

  test("the evaluation bar can be hidden in Play with Coach, and Settings shows the choice", async ({ page }) => {
    await page.goto("/play");
    await page.getByRole("radio", { name: "Play with Coach" }).click();
    // It is no longer offered on the setup screen; it lives in the game and in Settings.
    await expect(page.getByRole("switch", { name: /evaluation bar/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("meter")).toHaveCount(1);
    await page.getByText("Coach settings").click(); // the in-game options are folded away
    const bar = page.getByRole("switch", { name: "Evaluation bar" });
    await expect(bar).toBeChecked();
    await bar.click(); // hide it from inside the game
    await expect(page.getByRole("meter")).toHaveCount(0);
    // The choice is a setting, so Settings shows it too. (Saving it asked this visitor how to keep it; they closed
    // that, so they are still a visitor, and nobody was made a guest without choosing.)
    await expect(page.getByRole("button", { name: /^Account:/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Settings" }).first().click();
    await page.getByRole("dialog").getByRole("tab", { name: /Appearance/ }).click();
    await expect(page.getByRole("dialog").getByRole("switch", { name: "Evaluation bar" })).not.toBeChecked();
  });

  test("captured pieces and the material lead are shown next to each player", async ({ page }) => {
    await page.goto("/play");
    await page.getByRole("radio", { name: "In person" }).click();
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
    await page.getByRole("tab", { name: "Sound & coach" }).click();
    await expect(page.getByRole("switch", { name: "Coach speaks its feedback aloud" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Announce moves to screen readers" })).toBeVisible();
  });

  test("a visitor has no Progress tab, and the page sends them home", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Learn" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Progress" })).toHaveCount(0);
    await page.goto("/progress");
    await page.waitForURL((url) => url.pathname === "/");
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
