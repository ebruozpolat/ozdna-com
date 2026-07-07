import { and, eq } from "drizzle-orm";
import { ERRORS, generateId } from "@ozdna/core";
import { getDb, tezmakaleAccounts, tezmakaleDailyUsage } from "@ozdna/db";
import {
  PLAN_LIMITS,
  initialTokensForPlan,
  type TezmakalePlan,
  type TezmakaleProduct,
  countWords,
  todayKey,
} from "./config.js";
import type { TezmakaleUser } from "./auth.js";

export interface UsageSnapshot {
  product: TezmakaleProduct;
  dailyUses: number;
  dailyLimit: number;
  wordsPerUse: number;
  tokensUsedToday: number;
  tokensRemaining: number;
}

function getDailyRow(accountId: string, product: TezmakaleProduct, usageDate: string) {
  const db = getDb();
  return db
    .select()
    .from(tezmakaleDailyUsage)
    .where(
      and(
        eq(tezmakaleDailyUsage.accountId, accountId),
        eq(tezmakaleDailyUsage.product, product),
        eq(tezmakaleDailyUsage.usageDate, usageDate),
      ),
    )
    .limit(1)
    .all()[0];
}

export function getUsageSnapshot(user: TezmakaleUser, product: TezmakaleProduct): UsageSnapshot {
  const limits = PLAN_LIMITS[user.plan][product];
  const row = getDailyRow(user.id, product, todayKey());
  const account = getDb()
    .select()
    .from(tezmakaleAccounts)
    .where(eq(tezmakaleAccounts.id, user.id))
    .limit(1)
    .all()[0];

  return {
    product,
    dailyUses: row?.useCount ?? 0,
    dailyLimit: limits.dailyUses,
    wordsPerUse: limits.wordsPerUse,
    tokensUsedToday: row?.tokensUsed ?? 0,
    tokensRemaining: account?.tokensRemaining ?? 0,
  };
}

export function getAllUsageSnapshots(user: TezmakaleUser): UsageSnapshot[] {
  return (["detector", "paraphrase"] as TezmakaleProduct[]).map((p) => getUsageSnapshot(user, p));
}

export function enforceProductLimit(input: {
  user: TezmakaleUser;
  product: TezmakaleProduct;
  text: string;
  requestId?: string;
}): { words: number; limits: (typeof PLAN_LIMITS)[TezmakalePlan][TezmakaleProduct] } {
  const limits = PLAN_LIMITS[input.user.plan][input.product];
  if (limits.dailyUses === 0) {
    throw ERRORS.forbidden(`${input.product} requires PRO plan`, input.requestId);
  }

  const words = countWords(input.text);
  if (words === 0) {
    throw ERRORS.invalidRequest("Text is required", input.requestId);
  }
  if (words > limits.wordsPerUse) {
    throw ERRORS.invalidRequest(`Text exceeds ${limits.wordsPerUse} word limit for this plan`, input.requestId);
  }

  const snapshot = getUsageSnapshot(input.user, input.product);
  if (snapshot.dailyUses >= limits.dailyUses) {
    throw ERRORS.quotaExceeded(input.requestId);
  }

  return { words, limits };
}

export function recordProductUsage(input: {
  accountId: string;
  product: TezmakaleProduct;
  tokensUsed?: number;
}): void {
  const db = getDb();
  const usageDate = todayKey();
  const existing = getDailyRow(input.accountId, input.product, usageDate);
  const tokens = input.tokensUsed ?? 0;

  if (existing) {
    db.update(tezmakaleDailyUsage)
      .set({
        useCount: existing.useCount + 1,
        tokensUsed: existing.tokensUsed + tokens,
      })
      .where(eq(tezmakaleDailyUsage.id, existing.id))
      .run();
  } else {
    db.insert(tezmakaleDailyUsage).values({
      id: generateId("tmu"),
      accountId: input.accountId,
      product: input.product,
      usageDate,
      useCount: 1,
      tokensUsed: tokens,
    }).run();
  }

  if (tokens > 0) {
    const account = db
      .select()
      .from(tezmakaleAccounts)
      .where(eq(tezmakaleAccounts.id, input.accountId))
      .limit(1)
      .all()[0];
    if (account) {
      db.update(tezmakaleAccounts)
        .set({
          tokensRemaining: Math.max(0, account.tokensRemaining - tokens),
          updatedAt: new Date(),
        })
        .where(eq(tezmakaleAccounts.id, input.accountId))
        .run();
    }
  }
}

export function setAccountPlan(accountId: string, plan: TezmakalePlan, tokensRemaining?: number): void {
  const db = getDb();
  const account = db
    .select()
    .from(tezmakaleAccounts)
    .where(eq(tezmakaleAccounts.id, accountId))
    .limit(1)
    .all()[0];
  if (!account) return;

  db.update(tezmakaleAccounts)
    .set({
      plan,
      tokensRemaining: tokensRemaining ?? initialTokensForPlan(plan),
      updatedAt: new Date(),
    })
    .where(eq(tezmakaleAccounts.id, accountId))
    .run();
}
