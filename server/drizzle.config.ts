import { defineConfig } from "drizzle-kit";

/** Generates SQL migrations from src/db/schema.ts into ./migrations, which Wrangler applies to D1. */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});
