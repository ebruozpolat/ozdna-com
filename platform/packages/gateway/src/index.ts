import { generateRequestId, ERRORS, type ApiContext, OzdnaError } from "@ozdna/core";
import { parseBearerToken, validateApiKey } from "@ozdna/auth";
import { checkQuota, incrementUsage } from "@ozdna/billing";
import { audit, log } from "@ozdna/observability";

export {
  cacheKey,
  getCachedResponse,
  setCachedResponse,
  withRetry,
  fetchUpstream,
  fetchUpstreamWithRetry,
  UpstreamError,
} from "./proxy.js";
export type { RetryOptions, UpstreamResponse } from "./proxy.js";

export interface GatewayRequest {
  authorization?: string;
  requestId?: string;
  path: string;
  method: string;
}

export interface GatewayContext {
  api: ApiContext;
  rateLimitPerMin: number;
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(apiKeyId: string, limit: number, requestId: string): void {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(apiKeyId);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(apiKeyId, { count: 1, resetAt: now + 60_000 });
    return;
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    const err = ERRORS.rateLimited(retryAfter, requestId);
    throw err;
  }

  bucket.count++;
}

export function authenticate(req: GatewayRequest): GatewayContext {
  const requestId = req.requestId ?? generateRequestId();
  const token = parseBearerToken(req.authorization);

  if (!token) throw ERRORS.unauthorized(requestId);

  const validated = validateApiKey(token, requestId);
  checkQuota(validated.context.orgId, requestId);
  checkRateLimit(validated.context.apiKeyId, validated.rateLimitPerMin, requestId);

  audit(
    validated.context.requestId,
    validated.context.orgId,
    validated.context.apiKeyId,
    "api.request",
    `${req.method} ${req.path}`,
  );

  log({
    level: "info",
    requestId: validated.context.requestId,
    component: "gateway",
    message: `${req.method} ${req.path}`,
    metadata: {
      orgId: validated.context.orgId,
      plan: validated.context.plan,
    },
  });

  return {
    api: validated.context,
    rateLimitPerMin: validated.rateLimitPerMin,
  };
}

export function completeRequest(ctx: GatewayContext, endpoint: string): void {
  incrementUsage(ctx.api.orgId);
  audit(ctx.api.requestId, ctx.api.orgId, ctx.api.apiKeyId, "api.complete", endpoint);
}

export function handleError(err: unknown, requestId?: string): Response {
  if (err instanceof OzdnaError) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const retryAfter = (err as OzdnaError & { retryAfter?: number }).retryAfter;
    if (retryAfter) headers["Retry-After"] = String(retryAfter);

    return new Response(JSON.stringify(err.toJSON()), {
      status: err.status,
      headers,
    });
  }

  log({
    level: "error",
    requestId: requestId ?? "unknown",
    component: "gateway",
    message: err instanceof Error ? err.message : "Unknown error",
  });

  return new Response(
    JSON.stringify(ERRORS.internal(requestId).toJSON()),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );
}
