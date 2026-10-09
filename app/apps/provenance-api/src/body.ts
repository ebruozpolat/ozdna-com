import type { Context } from "hono";
import type { z } from "zod";
import { HttpError } from "./errors.js";
import { MAX_BODY_BYTES } from "./schemas.js";

/** Read, size-cap, parse and validate a JSON body. Returns the parsed value and raw text. */
export async function readJson<T>(
  c: Context,
  schema: z.ZodType<T>,
): Promise<{ data: T; raw: string }> {
  const declared = Number(c.req.header("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    throw new HttpError(
      413,
      "payload_too_large",
      "BODY_TOO_LARGE",
      `Body exceeds ${MAX_BODY_BYTES} bytes.`,
    );
  }
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(
      413,
      "payload_too_large",
      "BODY_TOO_LARGE",
      `Body exceeds ${MAX_BODY_BYTES} bytes.`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_request", "INVALID_JSON", "Body is not valid JSON.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "invalid_request",
      "VALIDATION_ERROR",
      "Request body does not match the schema.",
      parsed.error.issues.slice(0, 20).map((i) => ({
        code: i.code,
        path: i.path.map(String).join("."),
        message: i.message,
      })),
    );
  }
  return { data: parsed.data, raw };
}
