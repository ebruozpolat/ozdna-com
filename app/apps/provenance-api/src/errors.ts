// One error shape for every response: { error, code, message }.
// `error` is the category, `code` the stable machine code, `message` human text.
// Messages never echo request bodies (no payload contents in responses' error text or logs).

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ErrorCategory =
  | "invalid_request"
  | "authentication_error"
  | "permission_error"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "unavailable"
  | "internal_error";

export interface ApiErrorBody {
  error: ErrorCategory;
  code: string;
  message: string;
  issues?: ReadonlyArray<{ code: string; path: string; message: string }>;
}

export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  error: ErrorCategory,
  code: string,
  message: string,
  issues?: ApiErrorBody["issues"],
) {
  const body: ApiErrorBody = { error, code, message, ...(issues ? { issues } : {}) };
  return c.json(body, status);
}

/** Thrown inside handlers/services and turned into an apiError by the app's onError. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly category: ErrorCategory,
    readonly code: string,
    message: string,
    readonly issues?: ApiErrorBody["issues"],
  ) {
    super(message);
    this.name = "HttpError";
  }
}
