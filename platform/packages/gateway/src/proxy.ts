import { createHash } from "node:crypto";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  retryOn?: (status: number) => boolean;
}

const DEFAULT_RETRY_ON = (status: number) => status === 429 || status === 502 || status === 503 || status === 504;

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const retryOn = opts.retryOn ?? DEFAULT_RETRY_ON;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (attempt >= maxAttempts || status === undefined || !retryOn(status)) {
        throw err;
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CacheEntry {
  expiresAt: number;
  body: unknown;
}

const responseCache = new Map<string, CacheEntry>();

export function cacheKey(orgId: string, endpoint: string, body: unknown): string {
  const raw = JSON.stringify({ orgId, endpoint, body });
  return createHash("sha256").update(raw).digest("hex");
}

export function getCachedResponse(key: string): unknown | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.body;
}

export function setCachedResponse(key: string, body: unknown, ttlMs: number): void {
  if (ttlMs <= 0) return;
  responseCache.set(key, { expiresAt: Date.now() + ttlMs, body });
}

export interface UpstreamResponse {
  status: number;
  json: unknown;
  headers: Record<string, string>;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function fetchUpstream(
  url: string,
  init: RequestInit,
): Promise<UpstreamResponse> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new UpstreamError(`Upstream ${res.status}`, res.status, json);
  }

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });

  return { status: res.status, json, headers };
}

export async function fetchUpstreamWithRetry(
  url: string,
  init: RequestInit,
  retryOpts?: RetryOptions,
): Promise<UpstreamResponse> {
  return withRetry(() => fetchUpstream(url, init), retryOpts);
}
