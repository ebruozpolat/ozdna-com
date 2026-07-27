import { defineConfig } from "vitest/config";

// Foundation config: pure-math packages + PURE route logic run in the plain node environment.
// apps/api tests here inject an in-memory Repo (test/fakes.ts) and never touch hono/D1, so node
// suffices. The WORKERD integration tests (real D1 via @cloudflare/vitest-pool-workers 0.18.0,
// plan/09-DEV-SETUP.md §7 — ledger A5) are a SEPARATE, still-deferred project added when the
// D1-bound paths need coverage; this config deliberately does not run them.
export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    environment: "node",
  },
});
