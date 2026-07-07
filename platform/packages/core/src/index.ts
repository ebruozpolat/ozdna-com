export type VerticalMode = "academic" | "legal" | "financial" | "general";
export type PlanTier = "developer" | "startup" | "growth" | "enterprise";
export type KeyEnvironment = "test" | "live";
export type WorkflowStep = "detect" | "retrieve" | "generate" | "chat" | "completion" | "embeddings" | "rerank" | "moderation";

export interface ApiContext {
  requestId: string;
  orgId: string;
  projectId: string;
  apiKeyId: string;
  plan: PlanTier;
  environment: KeyEnvironment;
}

export interface UsageEvent {
  requestId: string;
  orgId: string;
  projectId: string;
  apiKeyId: string;
  endpoint: string;
  workflowId: string;
  step: WorkflowStep;
  model: string;
  mode: VerticalMode;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  status: "success" | "error";
}

export class OzdnaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "OzdnaError";
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      request_id: this.requestId,
    };
  }
}

export const ERRORS = {
  invalidRequest: (msg: string, id?: string) =>
    new OzdnaError("invalid_request", msg, 400, id),
  unauthorized: (id?: string) =>
    new OzdnaError("unauthorized", "Invalid or missing API key", 401, id),
  quotaExceeded: (id?: string) =>
    new OzdnaError("quota_exceeded", "Plan quota exceeded", 402, id),
  forbidden: (msg: string, id?: string) =>
    new OzdnaError("forbidden", msg, 403, id),
  notFound: (msg: string, id?: string) =>
    new OzdnaError("not_found", msg, 404, id),
  rateLimited: (retryAfter: number, id?: string) => {
    const err = new OzdnaError(
      "rate_limit_exceeded",
      `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      429,
      id,
    );
    (err as OzdnaError & { retryAfter: number }).retryAfter = retryAfter;
    return err;
  },
  internal: (id?: string) =>
    new OzdnaError("internal_error", "Internal server error", 500, id),
} as const;

export function generateRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
