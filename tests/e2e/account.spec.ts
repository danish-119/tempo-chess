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

  test("a visitor's first save makes them a guest, and it is still there after a reload", async ({ page }) => {
    await page.goto("/learn");
    await page.getByRole("button", { name: "Settings" }).click();
    const coords = page.getByRole("dialog").getByLabel("Board coordinates");
    const before = await coords.isChecked();
    await coords.click();
    // The quiet guest appears in the header, with a picture menu instead of "Sign in".
    await expect(page.getByRole("button", { name: "Account: Guest" })).toBeVisible();
    expect(await hasSession(page)).toBe(true);
    await page.keyboard.press("Escape");

    await page.waitForTimeout(800); // the save is sent a moment after the change
    await page.reload();
    await page.getByRole("button", { name: "Account: Guest" }).click();
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

    await page.getByRole("button", { name: "Change your name" }).click();
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
