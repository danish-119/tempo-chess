import { apiUp, clearRateLimits, playAsGuest, signedInPlayer } from "./local-api";
import { expect, test } from "@playwright/test";

/**
 * Online play through the real local API (see account.spec.ts for the setup): Play's modes and addresses, a whole
 * game between two signed-in players (one joining with the code) with a spectator watching, and a guest joining
 * from a link.
 */
test.describe("Play", () => {
  test("two main ways to play, the rest as chips, and each mode has its own address", async ({ page }) => {
    await page.goto("/play?mode=engines");
    await expect(page.getByRole("radio", { name: "Watch engines" })).toBeChecked();
    await page.getByRole("radio", { name: "Play the computer" }).click();
    await expect(page).toHaveURL(/mode=(bot|coach)/);
    await page.getByRole("radio", { name: "Play with Coach" }).click();
    await expect(page).toHaveURL(/mode=coach/);
    await page.getByRole("radio", { name: "Play online" }).click();
    await expect(page).toHaveURL(/mode=online/);
    await expect(page.getByRole("link", { name: "Set up a position" })).toHaveAttribute("href", /\/editor/);
  });

  test("the old online address forwards to online play", async ({ page }) => {
    await page.goto("/play/online");
    await page.waitForURL(/\/play\?mode=online/);
    await expect(page.getByRole("radio", { name: "Play online" })).toBeChecked();
  });

  test("a game page without a valid code asks for one", async ({ page }) => {
    await page.goto("/play/game");
    await expect(page.getByRole("heading", { name: "Join a game" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Join" })).toBeDisabled();
  });
});

test.describe("online games", () => {
  test.beforeAll(async () => {
    test.skip(!(await apiUp()), "the local API is not running");
    clearRateLimits();
  });

  test("a guest is offered a nickname and a picture, or Google", async ({ page }) => {
    await page.goto("/play?mode=online");
    await page.getByRole("button", { name: "Create a game" }).click();
    await expect(page.getByRole("dialog").getByLabel("Your nickname")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Picture", exact: true }).getByRole("radio")).toHaveCount(8);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("create a game, share the code, a friend joins, they play, and someone watches", async ({ browser }) => {
    const anna = await signedInPlayer(browser, "Anna");
    const ben = await signedInPlayer(browser, "Ben");

    await anna.page.goto("/play?mode=online");
    await anna.page.getByRole("radio", { name: "5 min blitz", exact: true }).check({ force: true });
    await anna.page.getByRole("radio", { name: "White" }).check({ force: true });
    await anna.page.getByRole("button", { name: "Create a game" }).click();
    await anna.page.waitForURL(/\/play\/game\?code=[A-Z2-9]{6}$/);
    await expect(anna.page.getByRole("heading", { name: "Send this code to your friend" })).toBeVisible();
    const code = new URL(anna.page.url()).searchParams.get("code")!;

    // Ben types the code on Play.
    await ben.page.goto("/play?mode=online");
    await ben.page.getByLabel("Game code").fill(code.toLowerCase());
    await ben.page.getByRole("button", { name: "Join", exact: true }).click();
    await ben.page.waitForURL(new RegExp(`code=${code}`));
    await ben.page.getByRole("button", { name: "Join the game" }).click();

    // Both see the board; Anna has White and it is her move.
    await expect(anna.page.getByRole("status").filter({ hasText: "Your move." })).toBeVisible();
    await expect(ben.page.getByText("you play Black")).toBeVisible();
    await expect(anna.page.getByRole("timer", { name: `${anna.name} clock` })).toHaveText(/^5:00$/);

    // A guest opens the same address and watches.
    const watcherCtx = await browser.newContext();
    const watcher = await watcherCtx.newPage();
    await watcher.goto(`/play/game?code=${code}`);
    await expect(watcher.getByText("watching")).toBeVisible();
    await expect(anna.page.getByLabel("1 watching")).toBeVisible();

    await anna.page.locator('[data-square="e2"]').first().click();
    await anna.page.locator('[data-square="e4"]').first().click();
    await expect(ben.page.getByRole("list", { name: "Moves" })).toContainText(/1\.\s*e4/);
    await expect(watcher.getByRole("list", { name: "Moves" })).toContainText(/1\.\s*e4/);
    await ben.page.locator('[data-square="e7"]').first().click();
    await ben.page.locator('[data-square="e5"]').first().click();
    await expect(anna.page.getByRole("list", { name: "Moves" })).toContainText(/1\.\s*e4\s*e5/);

    // Ben resigns: everyone sees the result.
    await ben.page.getByRole("button", { name: "Resign" }).click();
    await ben.page.getByRole("button", { name: "Yes, resign" }).click();
    await expect(anna.page.getByRole("status").filter({ hasText: "You won by resignation." })).toBeVisible();
    await expect(ben.page.getByRole("status").filter({ hasText: "You lost by resignation." })).toBeVisible();
    await expect(watcher.getByRole("status").filter({ hasText: `${anna.name} won by resignation.` })).toBeVisible();
    await expect(anna.page.getByRole("button", { name: "Review this game" })).toBeVisible();
  });

  test("a friend without an account joins from the link as a guest", async ({ browser }) => {
    const anna = await signedInPlayer(browser, "Eve");
    await anna.page.goto("/play?mode=online");
    await anna.page.getByRole("button", { name: "Create a game" }).click();
    await anna.page.waitForURL(/\/play\/game\?code=[A-Z2-9]{6}$/);

    const friend = await (await browser.newContext()).newPage();
    await friend.goto(anna.page.url());
    await expect(friend.getByRole("heading", { name: `Play ${anna.name}` })).toBeVisible();
    // Joining asks how to play, in a dialog; choosing a guest then joins.
    await friend.getByRole("button", { name: "Join the game" }).click();
    await playAsGuest(friend, "Kasim");
    await expect(friend.getByText(/you play (White|Black)/)).toBeVisible();
    await expect(anna.page.getByText("Kasim").first()).toBeVisible();
    await expect(anna.page.getByText("Guest", { exact: true })).toBeVisible();
  });
});
