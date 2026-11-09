import { expect, type Page, test } from "@playwright/test";

const move = async (page: Page, from: string, to: string) => {
  await page.locator(`[data-square="${from}"]`).first().click();
  await page.locator(`[data-square="${to}"]`).first().click();
};

/** Open a lesson from the path by its title. */
const open = async (page: Page, title: string) => {
  await page.getByRole("button", { name: new RegExp(`^Lesson \\d+: ${title}(,|$)`) }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
};

test.describe("Learn the basics", () => {
  test("the lessons are laid out as a path, and Start opens the first one", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.getByRole("list").filter({ has: page.getByRole("link", { name: /Basics/ }) }).getByRole("link").first()).toContainText("Basics");
    await page.getByRole("link", { name: /Basics/ }).click();
    await expect(page).toHaveURL(/\/learn\/basics$/);

    await expect(page.getByText("Learn to play")).toBeVisible();
    await expect(page.getByText(/0 of \d+ lessons done/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Lesson 1: The goal, up next$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Lesson \d+: The ladder mate$/ })).toBeVisible();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("heading", { name: "The goal" })).toBeVisible();
    await expect(page.getByText("64 squares").first()).toBeVisible();
  });

  test("a lesson: naming squares, then the rook's three practices and its visual tip", async ({ page }) => {
    await page.goto("/learn/basics");
    await open(page, "Naming the squares");
    // Tap the named square: a wrong tap is named, so every tap teaches a square.
    const squares = page.getByRole("group", { name: "Board: tap a square" });
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText("Tap the square e4");
    await squares.getByRole("button", { name: "e5", exact: true }).click();
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText("That is e5");
    await squares.getByRole("button", { name: "e4", exact: true }).click();
    await page.getByRole("button", { name: "Next practice" }).click();
    await squares.getByRole("button", { name: "b7", exact: true }).click();
    await page.getByRole("button", { name: "Next practice" }).click();
    await squares.getByRole("button", { name: "h3", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // The rook: a wrong move is turned down kindly, the starred one is celebrated.
    await expect(page.getByRole("heading", { name: "The rook" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText("Move the rook up to the star");
    await move(page, "a1", "a3");
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText("Not quite");
    // the starred square stays lit after a wrong try
    await expect(page.locator('[data-square="a5"]').first()).toBeVisible();
    await move(page, "a1", "a5");
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText(/Nice|Well done|Good move|Exactly/);
    await page.getByRole("button", { name: "Next practice" }).click();
    await move(page, "h1", "c1");
    await page.getByRole("button", { name: "Next practice" }).click();
    await move(page, "d1", "d4");
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText("Rooks always go straight");
    await expect(page.getByText("A tip", { exact: true })).toBeVisible();
    await expect(page.getByText("This rook stands on an open file.").first()).toBeVisible({ timeout: 5000 });

    // Back on the path, the finished lessons are marked done.
    await page.getByRole("button", { name: "All lessons" }).click();
    await expect(page.getByRole("button", { name: /^Lesson \d+: The rook, done$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Lesson \d+: Naming the squares, done$/ })).toBeVisible();
  });

  test("the pieces lesson names each piece and lights up where it stands", async ({ page }) => {
    await page.goto("/learn/basics");
    await open(page, "The pieces");
    const legend = page.getByRole("list", { name: "The pieces" });
    for (const name of ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"]) await expect(legend.getByRole("button", { name: new RegExp(name) })).toBeVisible();
    const knight = legend.getByRole("button", { name: /Knight/ });
    await knight.click();
    await expect(knight).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("This is the knight. Each side has two knights")).toBeVisible();
  });

  test("the coach's arrows can be shown on demand", async ({ page }) => {
    await page.goto("/learn/basics");
    await open(page, "The rook");
    const show = page.getByRole("button", { name: "Show moves" });
    await expect(show).toHaveAttribute("aria-pressed", "false");
    await show.click();
    await expect(show).toHaveAttribute("aria-pressed", "true");
  });

  test("a tempting move that stalemates is explained, and can be tried again", async ({ page }) => {
    await page.goto("/learn/basics");
    await open(page, "Stalemate");
    await move(page, "f1", "f7");
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText("That is stalemate");
    await page.getByRole("button", { name: "Try again" }).click();
    await move(page, "f1", "f8");
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText(/Nice|Well done|Good move|Exactly/);
  });

  test("capturing is optional: taking a guarded pawn is explained", async ({ page }) => {
    await page.goto("/learn/basics");
    await open(page, "Take a free piece, or not");
    await move(page, "d2", "d5");
    await page.getByRole("button", { name: "Next practice" }).click();
    await move(page, "c1", "c4");
    await page.getByRole("button", { name: "Next practice" }).click();
    await move(page, "d2", "d5");
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText("never have to capture");
  });

  test("the explanations come with examples", async ({ page }) => {
    await page.goto("/learn/basics");
    await open(page, "En passant");
    await expect(page.getByRole("list", { name: "Examples" }).getByRole("listitem")).toHaveCount(3);
    await page.getByRole("button", { name: "All lessons" }).click();
    await open(page, "Promotion");
    await expect(page.getByRole("list", { name: "Examples" }).getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: "All lessons" }).click();
    await open(page, "Draws");
    await expect(page.getByRole("list", { name: "Examples" }).getByRole("listitem")).toHaveCount(3);
  });

  test("a practice from Black's side turns the board round", async ({ page }) => {
    await page.goto("/learn/basics");
    await open(page, "Writing moves down");
    await move(page, "g1", "f3");
    await page.getByRole("button", { name: "Next practice" }).click();
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText("You are Black");
    await move(page, "b8", "c6");
    await expect(page.getByRole("region", { name: "Lesson" }).getByRole("status")).toContainText(/Nice|Well done|Good move|Exactly/);
  });

  test("the path marks finished lessons and the next one glows", async ({ page }) => {
    await page.goto("/learn/basics");
    await open(page, "The queen");
    await move(page, "d1", "g4");
    await page.getByRole("button", { name: "Next practice" }).click();
    await move(page, "a1", "a5");
    await page.getByRole("button", { name: "Next practice" }).click();
    await move(page, "d1", "d4");
    await expect(page.getByText("A tip", { exact: true })).toBeVisible();
    // Back on the path (saved for the guest or account).
    await page.getByRole("button", { name: "All lessons" }).click();
    await expect(page.getByRole("button", { name: /^Lesson \d+: The queen, done$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Lesson 1: The goal, up next$/ })).toBeVisible();
  });

  test("the last lesson offers the next places to go", async ({ page }) => {
    await page.goto("/learn/basics");
    await open(page, "You are ready");
    await expect(page.getByRole("link", { name: "Play a game" })).toHaveAttribute("href", "/play");
    await expect(page.getByRole("link", { name: "Study openings" })).toHaveAttribute("href", "/learn/openings");
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByText("Learn to play")).toBeVisible();
  });
});
