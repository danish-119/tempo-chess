import { expect, type Page, test } from "@playwright/test";

const SCHOLARS = `[Event "E2E"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

async function importPgn(page: Page, pgn = SCHOLARS) {
  await page.goto("/review");
  await page.getByRole("tab", { name: "Paste PGN / link" }).click();
  await page.getByLabel("PGN or game link").fill(pgn);
  await page.getByRole("button", { name: "Load game" }).click();
  await page.waitForURL(/\/analyze\?game=/);
}

test.describe("Tempo", () => {
  test("landing page leads to working review import", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Play. Review. Improve.");
    await page.getByRole("link", { name: /Review a game/ }).first().click();
    await expect(page).toHaveURL(/\/review/);
  });

  test("imports a PGN, navigates with the keyboard and stays in sync", async ({ page }) => {
    await importPgn(page);
    await expect(page.getByText("Alice").first()).toBeVisible();
    await page.getByRole("tab", { name: "Moves" }).click();
    const status = page.locator("p[aria-live=polite]").filter({ hasText: "to move" });
    await expect(status).toContainText("Start");
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("ArrowRight");
    await expect(status).toContainText("Black to move");
    await page.keyboard.press("End");
    await expect(status).toContainText("checkmate");
    await expect(page.locator('[aria-current="step"]')).toHaveText(/Qxf7#/);
    await page.keyboard.press("Home");
    await expect(status).toContainText("Start");
  });

  test("autoplay steps through the game and stops at the end", async ({ page }) => {
    await importPgn(page);
    const status = page.locator("p[aria-live=polite]").filter({ hasText: "to move" });
    await page.getByRole("combobox", { name: "Autoplay speed" }).selectOption("500");
    await page.getByRole("button", { name: /Play through the game/ }).click();
    await expect(status).toContainText("checkmate", { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Play through the game/ })).toBeVisible();
  });

  test("runs real Stockfish live analysis", async ({ page }) => {
    await page.goto("/analyze");
    await page.getByRole("tab", { name: /Engine/ }).click();
    const lines = page.getByRole("list", { name: "Engine lines" });
    await expect(lines.locator("li").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Depth \d+/)).toBeVisible();
    await expect(page.getByText(/Stockfish 19/)).toBeVisible();
  });

  test.setTimeout(180_000);
  test("full review classifies the blunder, shows a board badge, explores the best line and exports", async ({ page }) => {
    await importPgn(page);
    // The review starts automatically when an imported game opens.
    await page.getByRole("tab", { name: "Review" }).click();
    await expect(page.getByRole("button", { name: /Next key moment/ })).toBeVisible({ timeout: 110_000 });
    // Jump to the key moment: 3…Nf6 allows mate.
    await page.getByRole("button", { name: /Next key moment/ }).click();
    await expect(page.getByText(/is a blunder/)).toBeVisible();
    await expect(page.getByText(/forced .*checkmate in 1/)).toBeVisible();
    await expect(page.getByRole("img", { name: "Blunder" })).toBeVisible();
    // Explore the engine's best line as a variation.
    await page.getByRole("button", { name: /^Best:/ }).click();
    await page.getByRole("tab", { name: "Moves" }).click();
    await expect(page.getByText("Variation", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to game" }).click();
    // Export the annotated PGN.
    await page.getByRole("tab", { name: "Game" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Annotated PGN" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/_tempo\.pgn$/);
    // Reopening a reviewed game (from Your games) shows the saved review and never starts a new one.
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Review" }).click();
    await page.locator("section", { has: page.getByRole("heading", { name: "Your games" }) }).getByRole("link").first().click();
    await page.getByRole("tab", { name: "Review" }).click();
    await expect(page.getByRole("button", { name: /Next key moment/ })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3000);
    await expect(page.getByText(/Reviewing/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Next key moment/ })).toBeVisible();
  });

  test("a guest's imported game is listed under Your games for the rest of the visit", async ({ page }) => {
    await importPgn(page);
    // Moving around inside the app keeps it (and so would a reload, once the visitor has saved something as a guest).
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Review" }).click();
    const list = page.getByRole("region", { name: "Your games" }).or(page.locator("section", { has: page.getByRole("heading", { name: "Your games" }) }));
    await expect(list.getByText(/Alice/).first()).toBeVisible();
    await list.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/analyze\?game=/);
  });

  test("reports an invalid PGN without crashing", async ({ page }) => {
    await page.goto("/review");
    await page.getByRole("tab", { name: "Paste PGN / link" }).click();
    await page.getByLabel("PGN or game link").fill("1. e4 e5 2. Qxf7 Kxf7");
    await page.getByRole("button", { name: "Load game" }).click();
    await expect(page.getByText(/illegal or unreadable move|Could not read/)).toBeVisible();
  });

  test("explains Chess.com links instead of fetching them", async ({ page }) => {
    await page.goto("/review");
    await page.getByRole("tab", { name: "Paste PGN / link" }).click();
    await page.getByLabel("PGN or game link").fill("https://www.chess.com/game/live/173851145610");
    await page.getByRole("button", { name: "Load game" }).click();
    await expect(page.getByText(/cannot fetch a single game by link/)).toBeVisible();
  });

  test("surfaces an engine loading failure with a retry", async ({ page }) => {
    await page.route("**/engine/**", (route) => route.abort());
    await page.goto("/analyze");
    await page.getByRole("tab", { name: /Engine/ }).click();
    await expect(page.getByText("Engine unavailable")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    // The board still works without the engine.
    await expect(page.getByRole("group", { name: /Analysis board/ })).toBeVisible();
  });

  test("keyboard users can reach the skip link and main navigation", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
  });

  test("analysis page fits one desktop screen without page scrolling", async ({ page }) => {
    await importPgn(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("plays against Stockfish with the coach, views history and undoes", async ({ page }) => {
    await page.goto("/play");
    await page.getByRole("radio", { name: /Play with Coach/ }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    // Wait until the coach has evaluated the start position (hint becomes available).
    await expect(page.getByRole("button", { name: "Hint" })).toBeEnabled({ timeout: 60_000 });
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    // Coach feedback for e4, then Stockfish replies.
    await expect(page.getByText(/^e4$/).first()).toBeVisible();
    await expect(page.locator("ol[aria-label=Moves] button")).toHaveCount(2, { timeout: 60_000 });
    await expect(page.getByText(/is (best|excellent|good|a book move|brilliant|a great move)/)).toBeVisible({ timeout: 30_000 });
    // A second move must also work (regression: coach + engine race).
    await expect(page.getByRole("button", { name: "Hint" })).toBeEnabled({ timeout: 60_000 });
    await page.locator('[data-square="g1"]').click();
    await page.locator('[data-square="f3"]').click();
    await expect(page.locator("ol[aria-label=Moves] button")).toHaveCount(4, { timeout: 60_000 });
    await expect(page.locator("ol[aria-label=Moves] button").nth(2)).toHaveText(/Nf3/);
    // View history without changing the game.
    await expect(page.getByRole("button", { name: "Hint" })).toBeEnabled({ timeout: 60_000 });
    await page.getByRole("button", { name: "First move" }).click();
    await expect(page.getByRole("button", { name: "Back to game" })).toBeVisible();
    await page.getByRole("button", { name: "Back to game" }).click();
    // Undo takes back our last move and the reply.
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator("ol[aria-label=Moves] button")).toHaveCount(2);
  });

  test("two players can play on one device", async ({ page }) => {
    await page.goto("/play");
    await page.getByRole("radio", { name: "In person" }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    // Before both sides have moved the game can only be aborted.
    await expect(page.getByRole("button", { name: "Abort" })).toBeVisible();
    await expect(page.getByRole("button", { name: /resigns/ })).toHaveCount(0);
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="e7"]').click();
    await page.locator('[data-square="e5"]').click();
    await expect(page.locator("ol[aria-label=Moves] button")).toHaveCount(2);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator("ol[aria-label=Moves] button")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Abort" })).toBeVisible();
    await page.locator('[data-square="e7"]').click();
    await page.locator('[data-square="e5"]').click();
    await expect(page.locator("ol[aria-label=Moves] button")).toHaveCount(2);
    // A draw needs both players: White offers, Black can decline.
    await page.getByRole("button", { name: "White offers draw" }).click();
    await expect(page.getByText("White offers a draw.")).toBeVisible();
    await page.getByRole("button", { name: "Decline" }).click();
    // Resigning needs confirmation.
    await page.getByRole("button", { name: "White resigns" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Black won")).toHaveCount(0);
    await page.getByRole("button", { name: "White resigns" }).click();
    await page.getByRole("button", { name: "Yes, resign" }).click();
    await expect(page.getByText("Black won")).toBeVisible();
    await expect(page.getByRole("button", { name: /Review this game/ })).toBeVisible();
  });

  test("friend mode can show two boards, one per player", async ({ page }) => {
    await page.goto("/play");
    await page.getByRole("radio", { name: "In person" }).click();
    await page.getByText("Two boards", { exact: true }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("group", { name: /White's board/ })).toBeVisible();
    await expect(page.getByRole("group", { name: /Black's board/ })).toBeVisible();
    await page.locator('#play-board-w-square-e2').click();
    await page.locator('#play-board-w-square-e4').click();
    await expect(page.locator("ol[aria-label=Moves] button")).toHaveCount(1);
  });

  test("settings open in a modal and close with Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: "dark" }).check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
  });

  test("practice serves a random puzzle with hint and solution", async ({ page }) => {
    await page.goto("/practice");
    await page.getByRole("button", { name: /^Puzzles/ }).click();
    await expect(page).toHaveURL(/mode=puzzles/);
    // First choose a level and a theme, as tiles; each choice is kept in the address.
    await page.getByRole("radiogroup", { name: "Level" }).getByRole("radio", { name: /^Beginner/ }).click();
    await expect(page).toHaveURL(/level=beginner/);
    await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: /^Everything/ }).click();
    await page.getByRole("button", { name: "Start solving" }).click();
    await expect(page.getByText(/to move — find the best move/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.getByText(/Look for a good move with your/)).toBeVisible();
    await page.getByRole("button", { name: "Solution" }).click();
    await expect(page.getByText(/^Rating \d+/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Next puzzle" }).click();
    await expect(page.getByText(/to move — find the best move/)).toBeVisible({ timeout: 15_000 });
  });

  test("practice starts on a mode choice; Back returns to it", async ({ page }) => {
    await page.goto("/practice");
    await expect(page.getByText(/to move — find the best move/)).toHaveCount(0);
    await page.getByRole("button", { name: /^Puzzle Rush/ }).click();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Score")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^[23]:\d\d$/)).toBeVisible();
    await page.getByRole("button", { name: "End run" }).click();
    await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("button", { name: /^Puzzle Rush/ })).toBeVisible();
  });

  test("board editor validates and hands the position on", async ({ page }) => {
    await page.goto("/editor");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("White needs a king.")).toBeVisible();
    await expect(page).toHaveURL(/fen=8%2F8/);
    await page.getByRole("button", { name: "Start position" }).click();
    const analyze = page.getByRole("link", { name: "Analyze" });
    await expect(analyze).toHaveAttribute("href", /\/analyze\?fen=rnbqkbnr/);
    await expect(page.getByRole("link", { name: "Play from here" })).toBeVisible();
  });

  test("endgame tablebase verdict for few pieces", async ({ page }) => {
    await page.route("https://tablebase.lichess.ovh/**", (route) =>
      route.fulfill({
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          category: "win",
          dtz: 1,
          dtm: 17,
          moves: [{ uci: "h7h8q", san: "h8=Q+", category: "loss", dtz: -2, dtm: -16 }],
        }),
      }),
    );
    await page.goto(`/analyze?fen=${encodeURIComponent("4k3/6KP/8/8/8/8/7p/8 w - - 0 1")}`);
    await page.getByRole("tab", { name: /Engine/ }).click();
    await expect(page.getByText("White wins · Mate in 9")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /h8=Q\+/ }).click();
  });

  test("endgames list and coordinate trainer", async ({ page }) => {
    await page.goto("/practice");
    await page.getByRole("button", { name: /^Endgames/ }).click();
    await expect(page.getByRole("button", { name: /Lucena position/ })).toBeVisible();
    await page.goBack();
    await page.getByRole("button", { name: /^Coordinates/ }).click();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText(/^[a-h][1-8]$/)).toBeVisible();
    await page.getByRole("button", { name: "Stop" }).click();
    // Name the square: four answer buttons.
    await page.getByRole("radio", { name: "Name the square" }).click();
    await page.getByRole("button", { name: "Again" }).click();
    await expect(page.getByRole("button", { name: /^[a-h][1-8]$/ })).toHaveCount(4);
    await page.getByRole("button", { name: "Stop" }).click();
    // Light or dark: answer once, the score moves.
    await page.getByRole("radio", { name: "Light or dark" }).click();
    await page.getByRole("button", { name: "Again" }).click();
    await page.getByRole("button", { name: /light/i }).click();
    await expect(page.getByText(/^(100|0)%$/)).toBeVisible();
  });

  test("a shared puzzle link opens that exact puzzle", async ({ page }) => {
    await page.goto("/practice?mode=puzzles&level=expert&id=U3xCb");
    await expect(page.getByText(/to move — find the best move/)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/id=U3xCb/);
    await page.getByRole("button", { name: "Solution" }).click();
    await expect(page.getByText(/^Rating 1201/)).toBeVisible({ timeout: 15_000 });
  });

  test("glossary search filters terms and links to lessons", async ({ page }) => {
    await page.goto("/learn/glossary");
    await page.getByRole("searchbox", { name: "Search the glossary" }).fill("en passant");
    const results = page.getByRole("list", { name: "Results" });
    await expect(results.getByRole("button", { name: "En passant" })).toBeVisible();
    await expect(results.getByRole("button")).toHaveCount(1);
    await results.getByRole("button", { name: "En passant" }).click();
    await expect(page.getByRole("complementary").getByRole("heading", { name: "En passant" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search the glossary" }).fill("");
    await page.getByRole("list", { name: "Topics" }).getByRole("button", { name: /^Tactics/ }).click();
    await page.getByRole("list", { name: "Tactics terms" }).getByRole("button", { name: /^Fork/ }).click();
    await page.getByRole("complementary").getByRole("link", { name: /Learn with examples/ }).click();
    await expect(page).toHaveURL(/\/learn\/tactics\?t=fork/);
  });

  test("learn an opening: watch, then practise the main line", async ({ page }) => {
    await page.goto("/learn");
    await page.getByRole("link", { name: /Openings/ }).click();
    await page.getByRole("button", { name: /Italian Game/ }).click();
    await expect(page).toHaveURL(/o=italian/);
    // Nothing is said over an empty board: the coach explains each move as it is played.
    await expect(page.getByRole("status").filter({ hasText: "Press Watch" })).toBeVisible();
    await page.getByRole("button", { name: "Next move" }).click();
    await expect(page.getByText("e4 · 1/12")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "White plays e4. White takes space in the centre" })).toBeVisible();
    await page.getByRole("button", { name: "Carry on" }).click();
    await expect(page.getByText("e5 · 2/12")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("status").filter({ hasText: "Black plays e5. Black does the same." })).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("radio", { name: "Practice" }).click();
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.getByText("Your move: play the main line")).toBeVisible({ timeout: 5_000 });
  });

  test("learn tactics: the coach explains, then you find it yourself with hints", async ({ page }) => {
    await page.goto("/learn/tactics?t=fork");
    const lesson = page.getByRole("region", { name: "Lesson" });
    await expect(lesson.getByRole("heading", { name: "Fork" })).toBeVisible();
    const status = lesson.getByRole("status");
    await expect(status).toContainText(/(White|Black) to move\. Find the fork\./, { timeout: 15_000 });
    await lesson.getByRole("button", { name: "Hint" }).click();
    await expect(status).toContainText("Look at your");
    await lesson.getByRole("button", { name: "Hint" }).click();
    await expect(status).toContainText("Try ");
    await lesson.getByRole("button", { name: "Show me" }).click();
    await expect(status).toContainText("Here is the answer");
    await expect(lesson.getByRole("button", { name: "Next practice" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Practise \d+ puzzles/ })).toHaveAttribute("href", /theme=fork/);
  });

  test("pawn promotion shows the piece picker on the board", async ({ page }) => {
    await page.goto(`/analyze?fen=${encodeURIComponent("8/P6k/8/8/8/8/8/K7 w - - 0 1")}`);
    await page.locator('[data-square="a7"]').click();
    await page.locator('[data-square="a8"]').click();
    const picker = page.getByRole("dialog", { name: "Choose a piece to promote to" });
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Promote to Knight" }).click();
    await expect(picker).toBeHidden();
    await page.getByRole("tab", { name: "Moves" }).click();
    await expect(page.locator('[aria-current="step"]')).toHaveText(/a8=N/);
  });

  test("mobile layout shows board and panel tabs @mobile", async ({ page }) => {
    await importPgn(page);
    await expect(page.getByRole("group", { name: /Analysis board/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Moves" })).toBeVisible();
    // On a phone the sections are a bar of icons along the bottom edge, with no hamburger menu.
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
    const bar = page.getByRole("navigation", { name: "Mobile" });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link")).toHaveCount(5);
    await expect(bar.getByRole("link", { name: "Review" })).toHaveAttribute("aria-current", "page");
    const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(width).toBeLessThanOrEqual(1);
  });
});
