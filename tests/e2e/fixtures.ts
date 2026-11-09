import { test as base, expect } from "@playwright/test";

/**
 * Most tests are not about saving, but many of them save something along the way (a setting, a finished game),
 * and a visitor's first save asks how to keep it. Close that dialog whenever it appears. The account tests, which
 * are about that choice, use the plain Playwright `test` instead.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addLocatorHandler(page.getByRole("dialog", { name: "Save your progress" }), async (dialog) => {
      await dialog.getByRole("button", { name: "Close" }).click();
    });
    await provide(page);
  },
});

export { expect };
