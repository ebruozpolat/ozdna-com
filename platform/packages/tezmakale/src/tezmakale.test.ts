import test from "node:test";
import assert from "node:assert/strict";
import { initSchema } from "@ozdna/db";
import { registerUser, loginUser, resolveSession } from "./auth.js";
import { enforceProductLimit, recordProductUsage, getUsageSnapshot } from "./limits.js";
import { countWords } from "./config.js";

test("countWords", () => {
  assert.equal(countWords("  hello   world  "), 2);
});

test("auth register login session", () => {
  initSchema();
  const email = `test-${Date.now()}@tezmakale.test`;
  const user = registerUser({ email, password: "password123", name: "Test User" });
  assert.equal(user.plan, "free");

  const session = loginUser({ email, password: "password123" });
  assert.ok(session.sessionToken.startsWith("tm_sess_"));

  const resolved = resolveSession(session.sessionToken);
  assert.equal(resolved.email, email);
});

test("free plan detector limits", () => {
  initSchema();
  const email = `limit-${Date.now()}@tezmakale.test`;
  registerUser({ email, password: "password123", name: "Limit" });
  const { user } = (() => {
    const s = loginUser({ email, password: "password123" });
    return { user: resolveSession(s.sessionToken) };
  })();

  enforceProductLimit({ user, product: "detector", text: "Bu bir test metnidir." });
  recordProductUsage({ accountId: user.id, product: "detector", tokensUsed: 10 });

  const snap = getUsageSnapshot(user, "detector");
  assert.equal(snap.dailyUses, 1);
});

test("free plan blocks paraphrase", () => {
  initSchema();
  const email = `para-${Date.now()}@tezmakale.test`;
  registerUser({ email, password: "password123", name: "Para" });
  const s = loginUser({ email, password: "password123" });
  const user = resolveSession(s.sessionToken);

  assert.throws(() => {
    enforceProductLimit({ user, product: "paraphrase", text: "Test metni" });
  });
});
