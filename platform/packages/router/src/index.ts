import { eq, and, desc } from "drizzle-orm";
import type { VerticalMode } from "@ozdna/core";
import { getDb, routingRules } from "@ozdna/db";

export type Workflow = "detect" | "chat" | "completion" | "embeddings" | "rerank" | "moderation";

export interface RouteDecision {
  model: string;
  fallbackModel: string | null;
  maxCostUsd: number | null;
  ruleId: string | null;
}

const FALLBACK: RouteDecision = {
  model: "gpt-4o-mini",
  fallbackModel: "gpt-3.5-turbo",
  maxCostUsd: 0.01,
  ruleId: null,
};

const DEFAULTS: Record<Workflow, Record<string, RouteDecision>> = {
  detect: {
    general: { model: "gpt-4o-mini", fallbackModel: "gpt-3.5-turbo", maxCostUsd: 0.01, ruleId: null },
    academic: { model: "gpt-4o-mini", fallbackModel: "gpt-4o", maxCostUsd: 0.02, ruleId: null },
    legal: { model: "gpt-4o-mini", fallbackModel: null, maxCostUsd: 0.02, ruleId: null },
    financial: { model: "gpt-4o-mini", fallbackModel: null, maxCostUsd: 0.02, ruleId: null },
  },
  chat: {
    general: { model: "gpt-4o-mini", fallbackModel: "gpt-4o", maxCostUsd: 0.05, ruleId: null },
    academic: { model: "gpt-4o-mini", fallbackModel: "gpt-4o", maxCostUsd: 0.05, ruleId: null },
    legal: { model: "gpt-4o", fallbackModel: "gpt-4o-mini", maxCostUsd: 0.08, ruleId: null },
    financial: { model: "gpt-4o-mini", fallbackModel: null, maxCostUsd: 0.05, ruleId: null },
  },
  completion: {
    general: { model: "gpt-4o-mini", fallbackModel: null, maxCostUsd: 0.05, ruleId: null },
    academic: { model: "gpt-4o-mini", fallbackModel: null, maxCostUsd: 0.05, ruleId: null },
    legal: { model: "gpt-4o-mini", fallbackModel: null, maxCostUsd: 0.05, ruleId: null },
    financial: { model: "gpt-4o-mini", fallbackModel: null, maxCostUsd: 0.05, ruleId: null },
  },
  embeddings: {
    general: { model: "text-embedding-3-small", fallbackModel: "local-bow", maxCostUsd: 0.002, ruleId: null },
    academic: { model: "text-embedding-3-small", fallbackModel: "local-bow", maxCostUsd: 0.002, ruleId: null },
    legal: { model: "text-embedding-3-small", fallbackModel: "local-bow", maxCostUsd: 0.002, ruleId: null },
    financial: { model: "text-embedding-3-small", fallbackModel: "local-bow", maxCostUsd: 0.002, ruleId: null },
  },
  rerank: {
    general: { model: "local-bow", fallbackModel: null, maxCostUsd: 0.001, ruleId: null },
    academic: { model: "local-bow", fallbackModel: null, maxCostUsd: 0.001, ruleId: null },
    legal: { model: "local-bow", fallbackModel: null, maxCostUsd: 0.001, ruleId: null },
    financial: { model: "local-bow", fallbackModel: null, maxCostUsd: 0.001, ruleId: null },
  },
  moderation: {
    general: { model: "omni-moderation-latest", fallbackModel: null, maxCostUsd: 0.001, ruleId: null },
    academic: { model: "omni-moderation-latest", fallbackModel: null, maxCostUsd: 0.001, ruleId: null },
    legal: { model: "omni-moderation-latest", fallbackModel: null, maxCostUsd: 0.001, ruleId: null },
    financial: { model: "omni-moderation-latest", fallbackModel: null, maxCostUsd: 0.001, ruleId: null },
  },
};

export function routeModel(
  workflow: Workflow,
  mode: VerticalMode = "general",
): RouteDecision {
  const db = getDb();

  const rules = db
    .select()
    .from(routingRules)
    .where(
      and(
        eq(routingRules.workflow, workflow),
        eq(routingRules.mode, mode),
        eq(routingRules.active, true),
      ),
    )
    .orderBy(desc(routingRules.priority))
    .limit(1)
    .all();

  const rule = rules[0];
  if (rule) {
    return {
      model: rule.primaryModel,
      fallbackModel: rule.fallbackModel,
      maxCostUsd: rule.maxCostUsd,
      ruleId: rule.id,
    };
  }

  return DEFAULTS[workflow]?.[mode] ?? DEFAULTS[workflow]?.general ?? FALLBACK;
}

export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
  "gpt-3.5-turbo": { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },
  "text-embedding-3-small": { input: 0.02 / 1_000_000, output: 0 },
  "text-embedding-3-large": { input: 0.13 / 1_000_000, output: 0 },
  "local-bow": { input: 0, output: 0 },
  "omni-moderation-latest": { input: 0.1 / 1_000_000, output: 0 },
};

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_COSTS[model] ?? MODEL_COSTS["gpt-4o-mini"];
  return tokensIn * rates.input + tokensOut * rates.output;
}
