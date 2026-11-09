import { apiUp, clearRateLimits, playAsGuest, signedInPlayer } from "./local-api";
import { expect, test } from "@playwright/test";

/**
 * Accounts and guests, against a real local API (`npm run dev` in server/, with APP_ORIGIN including
 * http://localhost:4173). Skipped when the API is not running.
 */
const hasSession = async (page: import("@playwright/test").Page) => (await page.context().cookies()).some((c) => c.name.endsWith("session_token"));

test.describe("accounts", () => {
  test.beforeAll(async () => {
    test.skip(!(await apiUp()), "the local API is not running");
    clearRateLimits();
  });

  test("a visitor who only looks around gets no session, and nothing is kept in the browser", async ({ page }) => {
    for (const path of ["/", "/learn", "/play", "/practice"]) await page.goto(path);
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    expect(await hasSession(page)).toBe(false);
    const stored = await page.evaluate(async () => ({ local: localStorage.length, idb: (await indexedDB.databases()).length }));
    expect(stored).toEqual({ local: 0, idb: 0 });
  });

  test("a visitor's first save asks how to keep it, and nobody becomes a guest without choosing", async ({ page }) => {
    await page.goto("/learn");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("dialog").getByLabel("Board coordinates").click();
    await page.keyboard.press("Escape");
    // Once Settings is closed, the first save asks: a guest nickname and picture, or Google.
    const ask = page.getByRole("dialog", { name: "Save your progress" });
    await expect(ask.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await ask.getByRole("button", { name: "Close" }).click();
    expect(await hasSession(page)).toBe(false);
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    // It asks once per visit: another change does not ask again.
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("dialog").getByLabel("Board coordinates").click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    await expect(ask).toHaveCount(0);
  });

  test("a visitor who saves as a guest keeps the change after a reload, and gets a Progress tab", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Progress" })).toHaveCount(0);
    await page.getByRole("button", { name: "Settings" }).click();
    const coords = page.getByRole("dialog").getByLabel("Board coordinates");
    const before = await coords.isChecked();
    await coords.click();
    await page.keyboard.press("Escape");
    await playAsGuest(page, "Quiet Owl");
    await expect(page.getByRole("button", { name: "Account: Quiet Owl" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Progress" })).toBeVisible();

    await page.waitForTimeout(800); // the change was uploaded when they chose
    await page.reload();
    await page.getByRole("button", { name: "Account: Quiet Owl" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page.getByRole("dialog").getByLabel("Board coordinates")).toBeChecked({ checked: !before });
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test("signing in is Google only: no email or password form", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Sign in to Tempo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });

  test("a signed-in player has a Tempo ID, can change their name, and signs out", async ({ browser }) => {
    const { page, name, tag } = await signedInPlayer(browser, "Anna");
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`Your Tempo ID is ${tag.split("").join(" ")}`) })).toBeVisible();

    await page.getByRole("button", { name: "Change name and picture" }).click();
    await page.getByLabel("Your name").fill("Anna Karpova");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Anna Karpova" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Account: Anna Karpova" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("a guest picks a nickname and a picture, gets a Tempo ID, and is invited to keep it with Google", async ({ page }) => {
    await page.goto("/play?mode=online");
    // Making a game asks how to play, in a dialog; choosing a guest then makes the game.
    await page.getByRole("button", { name: "Create a game" }).click();
    await expect(page.getByRole("button", { name: "Play as a guest" })).toBeDisabled();
    await playAsGuest(page, "Lucky Star");
    await page.waitForURL(/\/play\/game\?code=/);
    await page.goto("/play?mode=online");
    await expect(page.getByText("Playing as Lucky Star")).toBeVisible();
    // Guests are full players: they can join friends' games by code too.
    await expect(page.getByLabel("Game code")).toBeVisible();

    await page.getByRole("button", { name: "Account: Lucky Star" }).click();
    await expect(page.getByRole("menuitem", { name: /Sign in with Google/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Your guest profile" }).click();
    await expect(page.getByRole("heading", { name: "Keep your progress for good" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Your Tempo ID is/ })).toBeVisible();
  });
});
