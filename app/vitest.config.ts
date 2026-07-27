import { defineConfig } from "vitest/config";

// Foundation config: pure-math packages run in the plain node environment.
// Per plan/09-DEV-SETUP.md §7, api/anchor route tests will later run inside workerd via
// @cloudflare/vitest-pool-workers 0.18.0 — added when apps/api and apps/anchor land.
export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts"],
    environment: "node",
  },
});
