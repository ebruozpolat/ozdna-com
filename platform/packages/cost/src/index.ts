import { estimateCost } from "@ozdna/router";
import { getWorkflowMetrics } from "@ozdna/analytics";

export interface CostBreakdown {
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): CostBreakdown {
  return {
    model,
    tokensIn,
    tokensOut,
    costUsd: Math.round(estimateCost(model, tokensIn, tokensOut) * 1_000_000) / 1_000_000,
  };
}

export function getCostMetrics(orgId: string, workflowId: string, sinceHours = 24) {
  const metrics = getWorkflowMetrics(orgId, workflowId, sinceHours);
  const costPerCall =
    metrics.total_calls > 0
      ? Math.round((metrics.cost_usd / metrics.total_calls) * 10000) / 10000
      : 0;

  return {
    ...metrics,
    cost_per_call: costPerCall,
    cost_per_workflow: costPerCall,
    routed_to: metrics.models_used[0] ?? "unknown",
    llm_routing_active: metrics.models_used.length > 0,
  };
}

export function wouldExceedBudget(
  maxCostUsd: number | null,
  estimatedCost: number,
): boolean {
  if (maxCostUsd === null) return false;
  return estimatedCost > maxCostUsd;
}
