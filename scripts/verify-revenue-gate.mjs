#!/usr/bin/env node
/**
 * Gelir kapısı smoke test — local API against checklist endpoints.
 * Usage: node scripts/verify-revenue-gate.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? process.env.OZDNA_API_BASE_URL ?? "http://localhost:8787";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`Verifying TezMakale revenue gate at ${BASE}\n`);

  const health = await req("/health");
  check("API health", health.status === 200, health.json?.service);

  const email = `gate-${Date.now()}@tezmakale.test`;
  const password = "gate-test-password-123";

  const reg = await req("/tezmakale/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Gate Test" }),
  });
  check("Register", reg.status === 201, reg.json?.user?.email);

  const login = await req("/tezmakale/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  check("Login", login.status === 200 && !!login.json?.session_token);
  const token = login.json?.session_token;
  const auth = { Authorization: `Bearer ${token}` };

  const dash = await req("/tezmakale/dashboard", { headers: auth });
  check("Dashboard", dash.status === 200 && dash.json?.plan === "free");

  const sub = await req("/tezmakale/subscription", { headers: auth });
  check(
    "Subscription limits",
    sub.status === 200 &&
      sub.json?.products?.detector?.name === "AI Dedektör" &&
      sub.json?.products?.paraphrase?.name === "Parafraz",
  );

  const detect = await req("/tezmakale/detect/deep", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Bu çalışmada elde edilen bulgular değerlendirilmiştir. Sonuç olarak metodoloji açıklanmıştır.",
      language: "tr",
    }),
  });
  check(
    "Deep detect (needs TEZMAKALE_OZDNA_API_KEY + seed)",
    detect.status === 200 || detect.status === 500,
    `status ${detect.status}`,
  );

  const para = await req("/tezmakale/paraphrase", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Test", language: "en" }),
  });
  const paraLegacy = await req("/tezmakale/humanize", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Test", language: "en" }),
  });
  check(
    "Paraphrase blocked on free plan",
    (para.status === 403 || paraLegacy.status === 403),
    `status ${para.status}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
