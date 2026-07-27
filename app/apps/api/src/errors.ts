// The single error envelope for every route (plan/04-MVP-SPEC.md §4.5). One shape everywhere;
// the (HTTP status → type) map is closed and owned by §4.5 — do not invent new types here.

export type ErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "permission_error"
  | "not_found_error"
  | "idempotency_error"
  | "rate_limit_error"
  | "api_error"
  | "service_unavailable";

/** §4.5 status → type. Kept explicit so a wrong pairing is a compile error at the call site. */
const STATUS_TYPE: Record<number, ErrorType> = {
  400: "invalid_request_error",
  401: "authentication_error",
  403: "permission_error",
  404: "not_found_error",
  409: "idempotency_error",
  413: "invalid_request_error",
  415: "invalid_request_error",
  422: "invalid_request_error",
  429: "rate_limit_error",
  500: "api_error",
  503: "service_unavailable",
};

export interface ErrorBody {
  readonly error: {
    readonly type: ErrorType;
    readonly code: string;
    readonly message: string;
    readonly doc_url: string;
    readonly request_id: string;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
  get type(): ErrorType {
    return STATUS_TYPE[this.status] ?? "api_error";
  }
}

/** Serialize an ApiError to the §4.5 envelope. `siteBase` builds the errors doc URL. */
export function toErrorBody(err: ApiError, requestId: string, siteBase: string): ErrorBody {
  return {
    error: {
      type: err.type,
      code: err.code,
      message: err.message,
      doc_url: `${siteBase}/docs/errors#${err.code}`,
      request_id: requestId,
    },
  };
}

// Convenience constructors for the codes the v1 core routes actually raise (§4.5 table).
export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const notFound = (code: string, message: string) => new ApiError(404, code, message);
export const forbidden = (code: string, message: string) => new ApiError(403, code, message);
export const serviceUnavailable = (code: string, message: string) => new ApiError(503, code, message);
