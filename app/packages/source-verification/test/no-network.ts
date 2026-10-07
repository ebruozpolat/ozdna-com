// Network guard: imported first by every test file in this package. Replaces globalThis.fetch
// with a function that records the attempt and throws, and fails the test after the fact if
// anything tried — so CI can never reach Crossref, DataCite or doi.org, even through code
// that swallows the error (adapters turn network errors into UNVERIFIED).

import { afterEach } from "vitest";

const attempts: string[] = [];

async function blockedFetch(input: unknown): Promise<Response> {
  const url = typeof input === "string" ? input : String((input as { url?: string })?.url ?? input);
  attempts.push(url);
  throw new Error(`unmocked network call blocked in tests: ${url}`);
}

globalThis.fetch = blockedFetch as typeof fetch;

afterEach(() => {
  if (attempts.length > 0) {
    const seen = attempts.splice(0);
    throw new Error(`test made ${seen.length} unmocked fetch call(s): ${seen.join(", ")}`);
  }
});

/** For the guard's own test only: read and clear recorded attempts. */
export function takeBlockedAttempts(): string[] {
  return attempts.splice(0);
}
