import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/** Scroll to a point inside the tall scene that contains the heading `id` (0 = its start, 1 = its end). */
async function scrollScene(page: Page, id: string, fraction: number) {
  await page.evaluate(
    ([id, f]) => {
      const section = document.getElementById(id)?.closest("section");
      if (!section) throw new Error(`no section for #${id}`);
      const top = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + (f as number) * Math.max(0, section.offsetHeight - window.innerHeight));
    },
    [id, fraction] as const,
  );
  await page.waitForTimeout(400);
}

test.describe("Landing page", () => {
  test("tells the whole story with real content and no errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Play. Review. Improve.");
    for (const name of ["Four ways to play", "Every move graded. With a reason.", "Train what you actually get wrong.", "Your move."]) {
      await expect(page.locator("h2").filter({ hasText: name })).toBeAttached(); // the Studio chapters not on screen are aria-hidden, so match by element
    }
    // The hero replays a real review: a grade badge and a real sentence are on screen from the first frame.
    await expect(page.getByLabel("Opera Game replay")).toBeVisible();
    await expect(page.locator("figure").first().getByText(/Brilliant|Best|Good|Excellent|Inaccuracy|Mistake|Blunder|Great|Book/).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("has no horizontal scrolling on a phone or a desktop", async ({ page }) => {
    for (const size of [{ width: 375, height: 800 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      await page.goto("/");
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `overflow at ${size.width}px`).toBeLessThanOrEqual(0);
    }
  });

  test("the hero replay can be paused", async ({ page }) => {
    await page.goto("/");
    const pause = page.getByRole("button", { name: "Pause the replay" });
    await pause.click();
    await expect(page.getByRole("button", { name: "Play the replay" })).toBeVisible();
    const before = await page.locator("figure").first().innerText();
    await page.waitForTimeout(2500);
    expect(await page.locator("figure").first().innerText()).toBe(before);
  });

  test("the Studio scene moves from Play to Review to Practice as you scroll", async ({ page }) => {
    await page.goto("/");
    const scene = page.locator('section[data-scene="studio"]');
    await scrollScene(page, "play-h", 0.05);
    await expect(scene).toHaveAttribute("data-chapter", "0");
    await expect(page.getByRole("heading", { name: "Four ways to play" })).toBeVisible();
    await scrollScene(page, "play-h", 0.5);
    await expect(scene).toHaveAttribute("data-chapter", "1");
    await expect(page.getByRole("heading", { name: "Every move graded. With a reason." })).toBeVisible();
    await scrollScene(page, "play-h", 0.92);
    await expect(scene).toHaveAttribute("data-chapter", "2");
    await expect(page.getByRole("heading", { name: "Train what you actually get wrong." })).toBeVisible();
  });

  test("the Review chapter draws the graph and lands the key moments", async ({ page }) => {
    await page.goto("/");
    await scrollScene(page, "play-h", 0.345);
    await expect(page.getByText(/Keep scrolling/)).toBeVisible();
    await scrollScene(page, "play-h", 0.665);
    await expect(page.getByRole("img", { name: /Evaluation graph of the Opera Game/ })).toBeVisible();
    await expect(page.getByText("Checkmate on the back rank!")).toBeVisible();
    await expect(page.getByText("98.6")).toBeVisible(); // White's accuracy has counted up (a real figure from the review)
  });

  test("the footer links to the author's profiles and email", async ({ page }) => {
    await page.goto("/");
    const profiles = page.getByRole("list", { name: "Find the author online" });
    await expect(profiles.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/danish-119");
    await expect(profiles.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/danish-119gb/");
    await expect(profiles.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:mdanish.software.dev@gmail.com");
  });

  test("call-to-action buttons go to the app", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Play now" }).first().click();
    await expect(page).toHaveURL(/\/play$/);
  });

  test("shows everything at once, with nothing pinned or moving, when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("[data-scene]")).toHaveCount(0); // no pinned, scrubbed scenes
    await expect(page.getByRole("button", { name: /replay/ })).toHaveCount(0); // nothing autoplays, so no pause button
    for (const title of ["Four ways to play", "Every move graded. With a reason.", "Train what you actually get wrong."]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });
});
