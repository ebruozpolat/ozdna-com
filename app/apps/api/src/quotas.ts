export type MonthlyQuotas = {
  mark: number;
  registration: number;
};

export const MONTHLY_QUOTAS_BY_PLAN: Record<string, MonthlyQuotas> = {
  free: { mark: 25, registration: 50 },
  starter: { mark: 2000, registration: 2000 },
  growth: { mark: 10000, registration: 10000 },
  scale: { mark: 50000, registration: 50000 },
};

export function quotasForPlan(plan: string): MonthlyQuotas {
  return MONTHLY_QUOTAS_BY_PLAN[plan] ?? MONTHLY_QUOTAS_BY_PLAN.free!;
}
