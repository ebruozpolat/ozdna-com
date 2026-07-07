export type TezmakalePlan = "free" | "pro" | "academic" | "max";

/** Internal product key; user-facing label is Parafraz (not Hümanizer). */
export type TezmakaleProduct = "detector" | "paraphrase";

/** @deprecated use paraphrase */
export type LegacyTezmakaleProduct = "humanizer";

export interface ProductLimits {
  dailyUses: number;
  wordsPerUse: number;
  /** Monthly token budget (free plan). */
  monthlyTokens: number;
  /** Daily token budget (paid plans); informational for dashboard. */
  dailyTokens: number;
}

export const PRODUCT_LABELS: Record<TezmakaleProduct, string> = {
  detector: "AI Dedektör",
  paraphrase: "Parafraz",
};

export const MODEL_LABELS: Record<TezmakaleProduct, string> = {
  detector: "OZDNA DT 5.0",
  paraphrase: "OZDNA HUMAN 1.0",
};

export const PLAN_LABELS: Record<TezmakalePlan, string> = {
  free: "Ücretsiz",
  pro: "PRO",
  academic: "Akademik",
  max: "MAX",
};

/** Limits aligned with tezmakale.com/pricing/ (2026-07). */
export const PLAN_LIMITS: Record<TezmakalePlan, Record<TezmakaleProduct, ProductLimits>> = {
  free: {
    detector: { dailyUses: 50, wordsPerUse: 1000, monthlyTokens: 40_000, dailyTokens: 0 },
    paraphrase: { dailyUses: 0, wordsPerUse: 0, monthlyTokens: 0, dailyTokens: 0 },
  },
  pro: {
    detector: { dailyUses: 100, wordsPerUse: 2000, monthlyTokens: 0, dailyTokens: 80_000 },
    paraphrase: { dailyUses: 50, wordsPerUse: 2000, monthlyTokens: 0, dailyTokens: 40_000 },
  },
  academic: {
    detector: { dailyUses: 200, wordsPerUse: 4000, monthlyTokens: 0, dailyTokens: 400_000 },
    paraphrase: { dailyUses: 100, wordsPerUse: 4000, monthlyTokens: 0, dailyTokens: 200_000 },
  },
  max: {
    detector: { dailyUses: 9999, wordsPerUse: 8000, monthlyTokens: 0, dailyTokens: 0 },
    paraphrase: { dailyUses: 500, wordsPerUse: 8000, monthlyTokens: 0, dailyTokens: 1_000_000 },
  },
};

export function normalizeProduct(product: string): TezmakaleProduct {
  if (product === "humanizer" || product === "paraphrase") return "paraphrase";
  if (product === "detector") return "detector";
  throw new Error(`Unknown product: ${product}`);
}

export function initialTokensForPlan(plan: TezmakalePlan): number {
  if (plan === "free") {
    return PLAN_LIMITS.free.detector.monthlyTokens;
  }
  const limits = PLAN_LIMITS[plan];
  return limits.detector.dailyTokens + limits.paraphrase.dailyTokens;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
