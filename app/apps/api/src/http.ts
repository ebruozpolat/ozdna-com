// A route handler's pure result: status + JSON body (+ optional extra headers). index.ts
// serializes this to a Hono Response. Keeping handlers I/O-free at this seam is what makes
// them node-unit-testable without workerd.

export interface RouteResult {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Clock + token seams so handlers stay deterministic under test. */
export interface RouteDeps {
  /** Current time as an ISO-8601 UTC string (matches D1 default timestamp format). */
  now(): string;
  /** Opaque confirmation/idempotency token (crypto.randomUUID in prod, fixed in tests). */
  newToken(): string;
}
