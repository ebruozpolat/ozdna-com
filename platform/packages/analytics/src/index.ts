import { eq, and, gte, sql } from "drizzle-orm";
import { generateId, type UsageEvent } from "@ozdna/core";
import { getDb, usageEvents } from "@ozdna/db";

export function recordUsage(event: UsageEvent): void {
  const db = getDb();
  db.insert(usageEvents)
    .values({
      id: generateId("evt"),
      requestId: event.requestId,
      orgId: event.orgId,
      projectId: event.projectId,
      apiKeyId: event.apiKeyId,
      endpoint: event.endpoint,
      workflowId: event.workflowId,
      step: event.step,
      model: event.model,
      mode: event.mode,
      tokensIn: event.tokensIn,
      tokensOut: event.tokensOut,
      costUsd: event.costUsd,
      latencyMs: event.latencyMs,
      status: event.status,
      createdAt: new Date(),
    })
    .run();
}

export function getUsageSummary(orgId: string, sinceHours = 24) {
  const db = getDb();
  const since = new Date(Date.now() - sinceHours * 3600_000);

  const rows = db
    .select({
      endpoint: usageEvents.endpoint,
      totalCalls: sql<number>`count(*)`,
      totalTokensIn: sql<number>`sum(${usageEvents.tokensIn})`,
      totalTokensOut: sql<number>`sum(${usageEvents.tokensOut})`,
      totalCostUsd: sql<number>`sum(${usageEvents.costUsd})`,
      avgLatencyMs: sql<number>`avg(${usageEvents.latencyMs})`,
    })
    .from(usageEvents)
    .where(and(eq(usageEvents.orgId, orgId), gte(usageEvents.createdAt, since)))
    .groupBy(usageEvents.endpoint)
    .all();

  return rows;
}

export function getWorkflowMetrics(orgId: string, workflowId: string, sinceHours = 24) {
  const db = getDb();
  const since = new Date(Date.now() - sinceHours * 3600_000);

  const rows = db
    .select()
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.orgId, orgId),
        eq(usageEvents.workflowId, workflowId),
        gte(usageEvents.createdAt, since),
      ),
    )
    .all();

  const totalCost = rows.reduce((s, r) => s + r.costUsd, 0);
  const totalTokens = rows.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  const models = [...new Set(rows.map((r) => r.model))];

  return {
    workflow_id: workflowId,
    period_hours: sinceHours,
    total_calls: rows.length,
    total_tokens: totalTokens,
    cost_usd: Math.round(totalCost * 10000) / 10000,
    models_used: models,
    premium_calls_saved: rows.filter((r) => r.model.includes("mini")).length,
  };
}
