import { defineConfig } from "vitest/config";

// Foundation config: packages + app route unit tests in plain node.
// D1-backed route integration tests will move to @cloudflare/vitest-pool-workers
// once remote D1/bindings are provisioned (see TOOLCHAIN.md).
export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    environment: "node",
  },
});
