import { eq } from "drizzle-orm";
import { ERRORS, type PlanTier } from "@ozdna/core";
import { getDb, billingAccounts } from "@ozdna/db";

export const PLAN_QUOTAS: Record<PlanTier, number> = {
  developer: 10_000,
  startup: 100_000,
  growth: 1_000_000,
  enterprise: Number.MAX_SAFE_INTEGER,
};

export const PLAN_RATE_LIMITS: Record<PlanTier, number> = {
  developer: 10,
  startup: 60,
  growth: 300,
  enterprise: 10_000,
};

export function checkQuota(orgId: string, requestId: string): void {
  const db = getDb();
  const account = db
    .select()
    .from(billingAccounts)
    .where(eq(billingAccounts.orgId, orgId))
    .limit(1)
    .all()[0];

  if (!account) return;

  if (account.usedThisMonth >= account.monthlyQuota) {
    throw ERRORS.quotaExceeded(requestId);
  }
}

export function incrementUsage(orgId: string): void {
  const db = getDb();
  const account = db
    .select()
    .from(billingAccounts)
    .where(eq(billingAccounts.orgId, orgId))
    .limit(1)
    .all()[0];

  if (!account) return;

  db.update(billingAccounts)
    .set({ usedThisMonth: account.usedThisMonth + 1 })
    .where(eq(billingAccounts.id, account.id))
    .run();
}

export function getBillingStatus(orgId: string) {
  const db = getDb();
  const account = db
    .select()
    .from(billingAccounts)
    .where(eq(billingAccounts.orgId, orgId))
    .limit(1)
    .all()[0];

  if (!account) {
    return { plan: "developer" as PlanTier, used: 0, quota: PLAN_QUOTAS.developer };
  }

  return {
    plan: account.plan as PlanTier,
    used: account.usedThisMonth,
    quota: account.monthlyQuota,
    remaining: account.monthlyQuota - account.usedThisMonth,
    period_start: account.periodStart.toISOString(),
  };
}
