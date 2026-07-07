import { eq } from "drizzle-orm";
import { ERRORS, generateId } from "@ozdna/core";
import { getDb, tezmakaleReportOrders } from "@ozdna/db";
import { ozdnaDeepDetect } from "./ozdna-client.js";

export function createReportOrder(input: {
  accountId: string;
  lemonOrderId: string;
  wordCount: number;
}) {
  const db = getDb();
  const id = generateId("rpt");
  db.insert(tezmakaleReportOrders).values({
    id,
    accountId: input.accountId,
    lemonOrderId: input.lemonOrderId,
    wordCount: input.wordCount,
    status: "processing",
    resultUrl: null,
    errorMessage: null,
    createdAt: new Date(),
    completedAt: null,
  }).run();
  return { id, ...input, status: "processing" as const };
}

export async function fulfillReportOrder(orderId: string, documentText: string): Promise<void> {
  const db = getDb();
  const order = db
    .select()
    .from(tezmakaleReportOrders)
    .where(eq(tezmakaleReportOrders.id, orderId))
    .limit(1)
    .all()[0];

  if (!order) return;

  try {
    const detect = await ozdnaDeepDetect({ text: documentText, language: "tr" });
    const summary = {
      order_id: orderId,
      word_count: order.wordCount,
      ai_probability: detect.ai_probability,
      verdict: detect.verdict,
      confidence: detect.confidence,
      segments: detect.segment_map,
      generated_at: new Date().toISOString(),
      disclaimer: "Karar destek amaçlıdır; kesin kanıt değildir.",
    };
    const resultUrl = `data:application/json;base64,${Buffer.from(JSON.stringify(summary)).toString("base64")}`;

    db.update(tezmakaleReportOrders)
      .set({
        status: "completed",
        resultUrl,
        completedAt: new Date(),
      })
      .where(eq(tezmakaleReportOrders.id, orderId))
      .run();
  } catch (err) {
    db.update(tezmakaleReportOrders)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Report generation failed",
      })
      .where(eq(tezmakaleReportOrders.id, orderId))
      .run();
  }
}

export function getReportOrder(orderId: string, accountId: string, requestId?: string) {
  const db = getDb();
  const order = db
    .select()
    .from(tezmakaleReportOrders)
    .where(eq(tezmakaleReportOrders.id, orderId))
    .limit(1)
    .all()[0];

  if (!order || order.accountId !== accountId) {
    throw ERRORS.notFound("Report not found", requestId);
  }

  return {
    id: order.id,
    status: order.status,
    word_count: order.wordCount,
    result_url: order.resultUrl,
    error_message: order.errorMessage,
    created_at: order.createdAt.toISOString(),
    completed_at: order.completedAt?.toISOString() ?? null,
  };
}
