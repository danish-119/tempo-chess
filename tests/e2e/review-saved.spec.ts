import { expect, test } from "@playwright/test";
import { apiUp, clearRateLimits, signedInPlayer } from "./local-api";

/**
 * A signed-in player's finished review is kept in their account: opening the game again, after a reload or on a
 * fresh visit, shows the saved review and never runs a new one. Needs the local API (see account.spec.ts).
 */
const PGN = `[Event "Saved review"]
[White "Carla"]
[Black "Dmitri"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

test.describe("saved reviews", () => {
  test.beforeAll(async () => {
    test.skip(!(await apiUp()), "the local API is not running");
    clearRateLimits();
  });

  test.setTimeout(180_000);
  test("a reviewed game opens with its saved review after a reload, and is listed under Reviewed", async ({ browser }) => {
    const { page } = await signedInPlayer(browser, "Rita");
    const reviewWrites: string[] = [];
    page.on("request", (r) => r.url().includes("/api/v1/reviews/") && r.method() === "PUT" && reviewWrites.push(r.url()));

    await page.goto("/review");
    await page.getByRole("tab", { name: "Paste PGN / link" }).click();
    await page.getByLabel("PGN or game link").fill(PGN);
    await page.getByRole("button", { name: "Load game" }).click();
    await page.waitForURL(/\/analyze\?game=/);
    await page.getByRole("tab", { name: "Review" }).click();
    await expect(page.getByRole("button", { name: /Next key moment/ })).toBeVisible({ timeout: 110_000 });
    await expect(page.getByText("The review could not be saved")).toHaveCount(0);
    await expect.poll(() => reviewWrites.length).toBe(1);

    for (const how of ["reload", "fresh visit"]) {
      if (how === "reload") await page.reload();
      else await page.goto(page.url());
      await page.getByRole("tab", { name: "Review" }).click();
      await expect(page.getByRole("button", { name: /Next key moment/ })).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(3000);
      await expect(page.getByText(/Reviewing/)).toHaveCount(0);
    }
    // Saved once, never reviewed again.
    expect(reviewWrites).toHaveLength(1);

    // The Review page lists it under Reviewed.
    await page.goto("/review");
    const yourGames = page.locator("section", { has: page.getByRole("heading", { name: "Your games" }) });
    await yourGames.getByRole("radio", { name: "Reviewed" }).click();
    await expect(yourGames.getByRole("link")).toHaveCount(1);
    await expect(yourGames.getByRole("link").first()).toContainText("Carla");
    await page.context().close();
  });
});
