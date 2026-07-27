import { defineConfig } from "vitest/config";

// Packages + plain-node route unit tests. D1/workerd suites live under
// apps/api (`*.workers.test.ts` via `npm run test:workers`).
export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.workers.test.ts"],
    environment: "node",
  },
});
