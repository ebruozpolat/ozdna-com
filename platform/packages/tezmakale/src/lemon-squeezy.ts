import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { generateId } from "@ozdna/core";
import { getDb, lemonSqueezyEvents, tezmakaleAccounts } from "@ozdna/db";
import type { TezmakalePlan } from "./config.js";
import { setAccountPlan } from "./limits.js";
import { createReportOrder, fulfillReportOrder } from "./reports.js";

export function verifyLemonSqueezySignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const digest = createHash("sha256").update(`${secret}${rawBody}`).digest("hex");
  try {
    return (
      digest.length === signature.length &&
      timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
    );
  } catch {
    return false;
  }
}

function payloadHash(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

function markEventProcessed(eventName: string, hash: string): boolean {
  const db = getDb();
  const existing = db
    .select()
    .from(lemonSqueezyEvents)
    .where(eq(lemonSqueezyEvents.payloadHash, hash))
    .limit(1)
    .all()[0];
  if (existing) return false;

  db.insert(lemonSqueezyEvents).values({
    id: generateId("ls"),
    eventName,
    payloadHash: hash,
    processedAt: new Date(),
  }).run();
  return true;
}

interface LemonPayload {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, string>;
  };
  data?: {
    id?: string;
    attributes?: Record<string, unknown>;
  };
}

function findAccountByCustomData(custom: Record<string, string> | undefined) {
  if (!custom?.account_id) return null;
  const db = getDb();
  return db
    .select()
    .from(tezmakaleAccounts)
    .where(eq(tezmakaleAccounts.id, custom.account_id))
    .limit(1)
    .all()[0];
}

function findAccountByEmail(email: string | undefined) {
  if (!email) return null;
  const db = getDb();
  return db
    .select()
    .from(tezmakaleAccounts)
    .where(eq(tezmakaleAccounts.email, email.toLowerCase()))
    .limit(1)
    .all()[0];
}

function planFromVariant(variantId: string | undefined): TezmakalePlan {
  const id = String(variantId ?? "");
  if (id && id === process.env.LEMONSQUEEZY_ACADEMIC_VARIANT_ID) return "academic";
  if (id && id === process.env.LEMONSQUEEZY_MAX_VARIANT_ID) return "max";
  if (id && id === process.env.LEMONSQUEEZY_PRO_VARIANT_ID) return "pro";
  return "pro";
}

export async function handleLemonSqueezyWebhook(rawBody: string): Promise<{ handled: boolean; event: string }> {
  const payload = JSON.parse(rawBody) as LemonPayload;
  const eventName = payload.meta?.event_name ?? "unknown";
  const hash = payloadHash(rawBody);

  if (!markEventProcessed(eventName, hash)) {
    return { handled: false, event: eventName };
  }

  const attrs = payload.data?.attributes ?? {};
  const custom = payload.meta?.custom_data;
  let account = findAccountByCustomData(custom);
  if (!account && typeof attrs.user_email === "string") {
    account = findAccountByEmail(attrs.user_email);
  }

  const db = getDb();
  const now = new Date();
  const variantId = String(attrs.variant_id ?? custom?.variant_id ?? "");

  switch (eventName) {
    case "subscription_created":
    case "subscription_updated":
    case "subscription_resumed": {
      if (account) {
        const plan = planFromVariant(variantId);
        db.update(tezmakaleAccounts)
          .set({
            plan,
            lemonSubscriptionId: String(payload.data?.id ?? account.lemonSubscriptionId),
            lemonCustomerId: String(attrs.customer_id ?? account.lemonCustomerId),
            updatedAt: now,
          })
          .where(eq(tezmakaleAccounts.id, account.id))
          .run();
        setAccountPlan(account.id, plan);
      }
      break;
    }
    case "subscription_cancelled":
    case "subscription_expired": {
      if (account) {
        db.update(tezmakaleAccounts)
          .set({ plan: "free", updatedAt: now })
          .where(eq(tezmakaleAccounts.id, account.id))
          .run();
        setAccountPlan(account.id, "free");
      }
      break;
    }
    case "order_created": {
      const orderId = String(payload.data?.id ?? "");
      const wordCount = Number(custom?.word_count ?? attrs.word_count ?? 1000);
      if (account && orderId) {
        const report = createReportOrder({
          accountId: account.id,
          lemonOrderId: orderId,
          wordCount,
        });
        await fulfillReportOrder(report.id, custom?.document_text ?? "");
      }
      break;
    }
    default:
      break;
  }

  return { handled: true, event: eventName };
}

export function getCheckoutConfig() {
  return {
    store_id: process.env.LEMONSQUEEZY_STORE_ID ?? null,
    pro_variant_id: process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? null,
    academic_variant_id: process.env.LEMONSQUEEZY_ACADEMIC_VARIANT_ID ?? null,
    max_variant_id: process.env.LEMONSQUEEZY_MAX_VARIANT_ID ?? null,
    report_variant_id: process.env.LEMONSQUEEZY_REPORT_VARIANT_ID ?? null,
  };
}
