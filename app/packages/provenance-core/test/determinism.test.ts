// Guard: the provenance packages must stay pure. Any clock read or randomness in src/
// would make hashes, checkpoints or (later) evidence packs non-reproducible.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const BANNED: Array<[RegExp, string]> = [
  [/\bDate\.now\s*\(/, "Date.now()"],
  [/new\s+Date\s*\(\s*\)/, "new Date() with no argument"],
  [/\bMath\.random\s*\(/, "Math.random()"],
  [/\bgetRandomValues\b/, "crypto.getRandomValues"],
  [/\brandomUUID\b/, "crypto.randomUUID"],
  [/\bperformance\.now\b/, "performance.now()"],
  [/\bfetch\s*\(/, "fetch()"],
  [/\bprocess\.env\b/, "process.env"],
  [/\bconsole\.(log|info|warn|error|debug)\b/, "console logging"],
];

function srcFiles(pkg: string): string[] {
  const dir = new URL(`../../${pkg}/src/`, import.meta.url);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => new URL(f, dir).pathname);
}

describe("provenance packages are pure", () => {
  const files = [...srcFiles("provenance-schema"), ...srcFiles("provenance-core")];

  it("found the source files", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(BANNED)("no %s in src/", (pattern) => {
    const hits = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("does not import the image product (dna-core) or any I/O module", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      expect(text).not.toMatch(/from\s+["']@ozdna\/dna-core/);
      expect(text).not.toMatch(/from\s+["']node:/);
    }
  });
});
