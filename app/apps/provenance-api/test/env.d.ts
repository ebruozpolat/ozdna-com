import type { Env } from "../src/env.js";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
    TEST_R2: R2Bucket;
  }
}
