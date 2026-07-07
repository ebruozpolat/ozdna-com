import { eq, sql } from "drizzle-orm";
import { getDb, tezmakaleDailyUsage, tezmakaleReportOrders } from "@ozdna/db";
import { MODEL_LABELS, PLAN_LABELS, PLAN_LIMITS, PRODUCT_LABELS } from "./config.js";
import { getAllUsageSnapshots } from "./limits.js";
import type { TezmakaleUser } from "./auth.js";
import { getCheckoutConfig } from "./lemon-squeezy.js";

export function getDashboard(user: TezmakaleUser) {
  const db = getDb();
  const usage = getAllUsageSnapshots(user);
  const scansThisMonth = db
    .select({ total: sql<number>`coalesce(sum(${tezmakaleDailyUsage.useCount}), 0)` })
    .from(tezmakaleDailyUsage)
    .where(eq(tezmakaleDailyUsage.accountId, user.id))
    .all()[0]?.total ?? 0;

  const reportsPending = db
    .select()
    .from(tezmakaleReportOrders)
    .where(eq(tezmakaleReportOrders.accountId, user.id))
    .all()
    .filter((r) => r.status === "processing" || r.status === "pending").length;

  const detector = usage.find((u) => u.product === "detector")!;
  const paraphrase = usage.find((u) => u.product === "paraphrase")!;

  return {
    welcome: user.name,
    plan: user.plan,
    plan_label: PLAN_LABELS[user.plan],
    scans_this_month: scansThisMonth,
    tokens_remaining: detector.tokensRemaining,
    detector_tokens_remaining: detector.tokensRemaining,
    paraphrase_tokens_remaining: paraphrase.tokensRemaining,
    detector_uses_today: detector.dailyUses,
    paraphrase_uses_today: paraphrase.dailyUses,
    reports_pending: reportsPending,
    quick_access: ["AI Dedektör", "Parafraz", "Detaylı Rapor"],
    models: {
      detector: MODEL_LABELS.detector,
      paraphrase: MODEL_LABELS.paraphrase,
    },
  };
}

export function getSubscription(user: TezmakaleUser) {
  const usage = getAllUsageSnapshots(user);
  const limits = PLAN_LIMITS[user.plan];

  const productPayload = (product: "detector" | "paraphrase") => {
    const snap = usage.find((u) => u.product === product)!;
    const lim = limits[product];
    return {
      name: PRODUCT_LABELS[product],
      model: MODEL_LABELS[product],
      daily_limit: lim.dailyUses,
      daily_token_budget: lim.dailyTokens,
      monthly_token_budget: lim.monthlyTokens,
      words_per_use: lim.wordsPerUse,
      used_today: snap.dailyUses,
      tokens_remaining: snap.tokensRemaining,
      available: lim.dailyUses > 0,
    };
  };

  return {
    plan: user.plan,
    plan_label: PLAN_LABELS[user.plan],
    checkout: getCheckoutConfig(),
    products: {
      detector: productPayload("detector"),
      paraphrase: productPayload("paraphrase"),
    },
    tokens_remaining: usage.find((u) => u.product === "detector")!.tokensRemaining,
  };
}
