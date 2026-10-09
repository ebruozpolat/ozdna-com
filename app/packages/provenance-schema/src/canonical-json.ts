// Canonical JSON — the byte form every provenance hash is computed over.
// Normative: app/docs/schemas/provenance-event-v1.md §3 ("ozdna-cjson/v1").
//
// Profile: RFC 8785 (JCS) restricted so that every value has exactly one encoding in
// every language:
//   - numbers: safe integers only (|n| ≤ 2^53−1); -0 encodes as 0. No floats, NaN, ∞, bigint.
//   - strings (values AND keys): well-formed UTF-16 (no lone surrogates) and already NFC.
//     We reject instead of normalising, so the hashed bytes are always the stored bytes.
//   - object keys sorted by UTF-16 code units (JCS); "__proto__" is rejected outright.
//   - only plain data: plain objects (Object.prototype or null prototype), dense arrays,
//     strings, safe integers, booleans, null. No undefined, getters, symbols, class
//     instances, sparse arrays, or extra properties on arrays.
//   - bounded depth and output size, so hostile input fails fast.

export type CanonicalErrorCode =
  | "UNSUPPORTED_TYPE"
  | "NON_INTEGER_NUMBER"
  | "UNSAFE_INTEGER"
  | "LONE_SURROGATE"
  | "NOT_NFC"
  | "NON_PLAIN_OBJECT"
  | "SYMBOL_KEY"
  | "NON_DATA_PROPERTY"
  | "FORBIDDEN_KEY"
  | "SPARSE_ARRAY"
  | "ARRAY_EXTRA_PROPERTIES"
  | "TOO_DEEP"
  | "TOO_LARGE"
  | "INVALID_JSON"
  | "NOT_CANONICAL";

export class CanonicalJsonError extends Error {
  readonly code: CanonicalErrorCode;
  readonly path: string;
  constructor(code: CanonicalErrorCode, path: string, message: string) {
    super(`${code} at ${path || "$"}: ${message}`);
    this.name = "CanonicalJsonError";
    this.code = code;
    this.path = path;
  }
}

export interface CanonicalizeOptions {
  /** Maximum nesting depth of objects/arrays (root container = depth 1). Default 32. */
  readonly maxDepth?: number;
  /** Maximum UTF-8 byte length of the output. Default 1 MiB. */
  readonly maxBytes?: number;
}

export const DEFAULT_MAX_DEPTH = 32;
export const DEFAULT_MAX_BYTES = 1024 * 1024;

/** True if `s` contains no unpaired surrogate code units. */
export function isWellFormedUtf16(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) return false;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function checkString(s: string, path: string): void {
  if (!isWellFormedUtf16(s)) {
    throw new CanonicalJsonError("LONE_SURROGATE", path, "string contains an unpaired surrogate");
  }
  if (s.normalize("NFC") !== s) {
    throw new CanonicalJsonError("NOT_NFC", path, "string is not in Unicode NFC");
  }
}

function keyPath(path: string, key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

class Writer {
  private readonly parts: string[] = [];
  private length = 0;
  constructor(private readonly maxBytes: number) {}
  push(s: string, path: string): void {
    this.parts.push(s);
    // UTF-16 length is a lower bound on UTF-8 length, so this bails early on huge input.
    this.length += s.length;
    if (this.length > this.maxBytes) {
      throw new CanonicalJsonError("TOO_LARGE", path, `output exceeds ${this.maxBytes} bytes`);
    }
  }
  finish(): string {
    return this.parts.join("");
  }
}

function write(value: unknown, w: Writer, path: string, depth: number, maxDepth: number): void {
  if (value === null) {
    w.push("null", path);
    return;
  }
  switch (typeof value) {
    case "boolean":
      w.push(value ? "true" : "false", path);
      return;
    case "number": {
      if (!Number.isInteger(value)) {
        throw new CanonicalJsonError("NON_INTEGER_NUMBER", path, "only integers are allowed");
      }
      if (!Number.isSafeInteger(value)) {
        throw new CanonicalJsonError("UNSAFE_INTEGER", path, "integer outside ±(2^53−1)");
      }
      // String(-0) is "0", matching JCS.
      w.push(String(value), path);
      return;
    }
    case "string":
      checkString(value, path);
      w.push(JSON.stringify(value), path);
      return;
    case "object":
      break;
    default:
      throw new CanonicalJsonError("UNSUPPORTED_TYPE", path, `type ${typeof value} is not JSON`);
  }

  if (depth >= maxDepth) {
    throw new CanonicalJsonError("TOO_DEEP", path, `nesting exceeds ${maxDepth}`);
  }

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new CanonicalJsonError("NON_PLAIN_OBJECT", path, "array subclass");
    }
    const ownNames = Object.getOwnPropertyNames(value);
    // own names = indices + "length" for a dense, plain array
    if (ownNames.length !== value.length + 1 || Object.getOwnPropertySymbols(value).length > 0) {
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(value, i)) {
          throw new CanonicalJsonError("SPARSE_ARRAY", `${path}[${i}]`, "array has a hole");
        }
      }
      throw new CanonicalJsonError("ARRAY_EXTRA_PROPERTIES", path, "array has extra properties");
    }
    w.push("[", path);
    for (let i = 0; i < value.length; i++) {
      const itemPath = `${path}[${i}]`;
      const desc = Object.getOwnPropertyDescriptor(value, i);
      if (!desc || !("value" in desc)) {
        throw new CanonicalJsonError("NON_DATA_PROPERTY", itemPath, "accessor property");
      }
      if (i > 0) w.push(",", itemPath);
      write(desc.value, w, itemPath, depth + 1, maxDepth);
    }
    w.push("]", path);
    return;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalJsonError("NON_PLAIN_OBJECT", path, "only plain objects are allowed");
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new CanonicalJsonError("SYMBOL_KEY", path, "symbol-keyed property");
  }
  const keys = Object.getOwnPropertyNames(value);
  // Default sort compares UTF-16 code units — exactly the JCS ordering.
  keys.sort();
  w.push("{", path);
  let first = true;
  for (const key of keys) {
    const p = keyPath(path, key);
    if (key === "__proto__") {
      throw new CanonicalJsonError("FORBIDDEN_KEY", p, "__proto__ is not allowed as a key");
    }
    checkString(key, p);
    const desc = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in desc) || !desc.enumerable) {
      throw new CanonicalJsonError("NON_DATA_PROPERTY", p, "accessor or non-enumerable property");
    }
    if (!first) w.push(",", p);
    first = false;
    w.push(JSON.stringify(key), p);
    w.push(":", p);
    write(desc.value, w, p, depth + 1, maxDepth);
  }
  w.push("}", path);
}

/** Canonical JSON text of `value`. Throws CanonicalJsonError on anything outside the profile. */
export function canonicalize(value: unknown, opts: CanonicalizeOptions = {}): string {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const w = new Writer(maxBytes);
  write(value, w, "", 0, opts.maxDepth ?? DEFAULT_MAX_DEPTH);
  const text = w.finish();
  if (utf8Length(text) > maxBytes) {
    throw new CanonicalJsonError("TOO_LARGE", "", `output exceeds ${maxBytes} bytes`);
  }
  return text;
}

const encoder = new TextEncoder();

/** Canonical JSON as UTF-8 bytes. */
export function canonicalBytes(value: unknown, opts: CanonicalizeOptions = {}): Uint8Array {
  return encoder.encode(canonicalize(value, opts));
}

/** UTF-8 byte length of a well-formed string, without allocating. */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/**
 * Parse JSON text that MUST already be canonical. Rejects duplicate keys, whitespace,
 * non-canonical numbers ("1.0", "1e2"), escapes JCS would not emit, and key order drift —
 * anything where two parsers could disagree about what the text means.
 */
export function parseCanonical(text: string, opts: CanonicalizeOptions = {}): unknown {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  if (text.length > maxBytes || utf8Length(text) > maxBytes) {
    throw new CanonicalJsonError("TOO_LARGE", "", `input exceeds ${maxBytes} bytes`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new CanonicalJsonError("INVALID_JSON", "", e instanceof Error ? e.message : "bad JSON");
  }
  const again = canonicalize(parsed, opts);
  if (again !== text) {
    throw new CanonicalJsonError("NOT_CANONICAL", "", "text is not in canonical form");
  }
  return parsed;
}

/**
 * Deep copy of plain JSON data with every string (values and keys) NFC-normalised.
 * Used by writers *before* hashing; verifiers never normalise (they reject non-NFC).
 * Lone surrogates are not repaired — canonicalize() will still reject them.
 */
export function normalizeNfcDeep<T>(value: T, maxDepth = DEFAULT_MAX_DEPTH): T {
  const go = (v: unknown, depth: number): unknown => {
    if (typeof v === "string") return v.normalize("NFC");
    if (v === null || typeof v !== "object") return v;
    if (depth >= maxDepth)
      throw new CanonicalJsonError("TOO_DEEP", "", `nesting exceeds ${maxDepth}`);
    if (Array.isArray(v)) return v.map((x) => go(x, depth + 1));
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) {
      throw new CanonicalJsonError("NON_PLAIN_OBJECT", "", "only plain objects are allowed");
    }
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) {
      const nk = k.normalize("NFC");
      if (Object.hasOwn(out, nk)) {
        // two keys that only differ in normalisation would silently merge — refuse
        throw new CanonicalJsonError("NOT_NFC", nk, "keys collide after NFC normalisation");
      }
      Object.defineProperty(out, nk, {
        value: go((v as Record<string, unknown>)[k], depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  };
  return go(value, 0) as T;
}
