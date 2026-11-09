import { defineConfig } from "vitest/config";

/** The API's unit tests: plain functions such as the online-game referee. */
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
