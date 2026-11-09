import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { __resetDocsForTests, resetDocs } from "@/lib/account/docs";
import { setAccount } from "@/lib/account/session";
import { resetMemory } from "@/lib/storage/db";

// Every test starts as a guest with nothing saved (the app keeps nothing in browser storage).
beforeEach(() => {
  __resetDocsForTests();
  resetMemory();
  setAccount({ status: "visitor" });
  resetDocs();
});
