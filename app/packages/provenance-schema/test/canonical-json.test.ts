import { describe, expect, it } from "vitest";
import {
  CanonicalJsonError,
  canonicalBytes,
  canonicalize,
  normalizeNfcDeep,
  parseCanonical,
} from "../src/canonical-json.js";

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof CanonicalJsonError) return e.code;
    throw e;
  }
  throw new Error("expected CanonicalJsonError");
}

describe("canonicalize — structure and ordering", () => {
  it("sorts keys recursively, keeps array order, no whitespace", () => {
    expect(canonicalize({ b: [3, 1, { z: 1, a: 2 }], a: null, c: true })).toBe(
      '{"a":null,"b":[3,1,{"a":2,"z":1}],"c":true}',
    );
  });

  it("is independent of key insertion order", () => {
    const x = { alpha: 1, beta: { y: 2, x: 1 } };
    const y = { beta: { x: 1, y: 2 }, alpha: 1 };
    expect(canonicalize(x)).toBe(canonicalize(y));
  });

  it("orders keys by UTF-16 code units (JCS), not by code point", () => {
    // U+1F600 is D83D DE00 in UTF-16, so it sorts BEFORE U+FFFF by code unit,
    // but AFTER it by code point. JCS mandates code units.
    const s = canonicalize({ "\uffff": 1, "\u{1f600}": 2 });
    expect(s).toBe('{"\u{1f600}":2,"\uffff":1}');
  });

  it("orders uppercase before lowercase and digits before letters (code units)", () => {
    expect(canonicalize({ b: 1, B: 2, "1": 3 })).toBe('{"1":3,"B":2,"b":1}');
  });

  it("accepts null-prototype objects", () => {
    const o = Object.create(null) as Record<string, unknown>;
    o.k = 1;
    expect(canonicalize(o)).toBe('{"k":1}');
  });

  it("emits UTF-8 bytes for canonicalBytes", () => {
    expect([...canonicalBytes("\u00e9")]).toEqual([0x22, 0xc3, 0xa9, 0x22]);
  });
});

describe("canonicalize — numbers", () => {
  it("encodes safe integers; -0 as 0", () => {
    expect(canonicalize([0, -0, 1, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER])).toBe(
      "[0,0,1,-1,9007199254740991,-9007199254740991]",
    );
  });

  it("rejects floats, NaN, Infinity", () => {
    expect(code(() => canonicalize(1.5))).toBe("NON_INTEGER_NUMBER");
    expect(code(() => canonicalize(Number.NaN))).toBe("NON_INTEGER_NUMBER");
    expect(code(() => canonicalize(Number.POSITIVE_INFINITY))).toBe("NON_INTEGER_NUMBER");
  });

  it("rejects integers beyond 2^53−1 (cross-language precision loss)", () => {
    expect(code(() => canonicalize(2 ** 53))).toBe("UNSAFE_INTEGER");
    expect(code(() => canonicalize(1e21))).toBe("UNSAFE_INTEGER");
  });

  it("rejects bigint", () => {
    expect(code(() => canonicalize(1n))).toBe("UNSUPPORTED_TYPE");
  });
});

describe("canonicalize — strings", () => {
  it("escapes like JCS: short escapes, lowercase \\u00xx for other controls, nothing else", () => {
    expect(canonicalize('\b\f\n\r\t"\\\u0001\u001f/\u007f\u2028\u00e9')).toBe(
      '"\\b\\f\\n\\r\\t\\"\\\\\\u0001\\u001f/\u007f\u2028\u00e9"',
    );
  });

  it("accepts paired surrogates, rejects lone ones (values and keys)", () => {
    expect(canonicalize("\u{1f600}")).toBe('"\u{1f600}"');
    expect(code(() => canonicalize("\ud83d"))).toBe("LONE_SURROGATE");
    expect(code(() => canonicalize("\ude00x"))).toBe("LONE_SURROGATE");
    expect(code(() => canonicalize("x\ud83d\ud83d"))).toBe("LONE_SURROGATE");
    expect(code(() => canonicalize({ "\ud800": 1 }))).toBe("LONE_SURROGATE");
  });

  it("rejects non-NFC strings instead of silently normalising (values and keys)", () => {
    const decomposed = "e\u0301"; // e + combining acute
    expect(code(() => canonicalize(decomposed))).toBe("NOT_NFC");
    expect(code(() => canonicalize({ [decomposed]: 1 }))).toBe("NOT_NFC");
    expect(canonicalize("\u00e9")).toBe('"\u00e9"');
  });

  it("two visually identical keys cannot both be hashed (one is not NFC)", () => {
    expect(code(() => canonicalize({ "\u00e9": 1, "e\u0301": 2 }))).toBe("NOT_NFC");
  });
});

describe("canonicalize — hostile shapes", () => {
  it("rejects __proto__ as an own key (as produced by JSON.parse)", () => {
    const o = JSON.parse('{"__proto__":{"polluted":1},"a":1}');
    expect(code(() => canonicalize(o))).toBe("FORBIDDEN_KEY");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects sparse arrays and arrays with extra properties", () => {
    // biome-ignore lint/suspicious/noSparseArray: deliberate hole
    expect(code(() => canonicalize([1, , 3]))).toBe("SPARSE_ARRAY");
    const a = [1, 2] as number[] & { extra?: number };
    a.extra = 1;
    expect(code(() => canonicalize(a))).toBe("ARRAY_EXTRA_PROPERTIES");
    expect(code(() => canonicalize(new Array(3)))).toBe("SPARSE_ARRAY");
  });

  it("rejects class instances, Date, Map, typed arrays, array subclasses", () => {
    class Foo {
      a = 1;
    }
    class MyArr extends Array {}
    expect(code(() => canonicalize(new Foo()))).toBe("NON_PLAIN_OBJECT");
    expect(code(() => canonicalize(new Date(0)))).toBe("NON_PLAIN_OBJECT");
    expect(code(() => canonicalize(new Map()))).toBe("NON_PLAIN_OBJECT");
    expect(code(() => canonicalize(new Uint8Array(2)))).toBe("NON_PLAIN_OBJECT");
    expect(code(() => canonicalize(MyArr.from([1])))).toBe("NON_PLAIN_OBJECT");
  });

  it("rejects getters without invoking them", () => {
    let calls = 0;
    const o = {
      get a() {
        calls++;
        return calls;
      },
    };
    expect(code(() => canonicalize(o))).toBe("NON_DATA_PROPERTY");
    expect(calls).toBe(0);
  });

  it("rejects non-enumerable and symbol-keyed properties", () => {
    const o = {};
    Object.defineProperty(o, "hidden", { value: 1, enumerable: false });
    expect(code(() => canonicalize(o))).toBe("NON_DATA_PROPERTY");
    expect(code(() => canonicalize({ [Symbol("s")]: 1 }))).toBe("SYMBOL_KEY");
  });

  it("rejects undefined, functions, symbols (JSON.stringify would silently drop them)", () => {
    expect(code(() => canonicalize({ a: undefined }))).toBe("UNSUPPORTED_TYPE");
    expect(code(() => canonicalize([() => 1]))).toBe("UNSUPPORTED_TYPE");
    expect(code(() => canonicalize(Symbol("x")))).toBe("UNSUPPORTED_TYPE");
    expect(code(() => canonicalize(undefined))).toBe("UNSUPPORTED_TYPE");
  });

  it("bounds depth; cyclic input fails with TOO_DEEP, not a stack overflow", () => {
    const cyc: Record<string, unknown> = {};
    cyc.self = cyc;
    expect(code(() => canonicalize(cyc))).toBe("TOO_DEEP");
    let deep: unknown = 1;
    for (let i = 0; i < 5; i++) deep = [deep];
    expect(canonicalize(deep, { maxDepth: 5 })).toBe("[[[[[1]]]]]");
    expect(code(() => canonicalize([deep], { maxDepth: 5 }))).toBe("TOO_DEEP");
  });

  it("bounds output size in UTF-8 bytes (multi-byte text cannot sneak past)", () => {
    expect(code(() => canonicalize("x".repeat(100), { maxBytes: 50 }))).toBe("TOO_LARGE");
    // 30 UTF-16 units but 62 UTF-8 bytes with quotes
    expect(code(() => canonicalize("\u00e9".repeat(30), { maxBytes: 50 }))).toBe("TOO_LARGE");
    expect(canonicalize("\u00e9".repeat(24), { maxBytes: 50 })).toHaveLength(26);
  });
});

describe("parseCanonical", () => {
  it("round-trips canonical text", () => {
    const text = '{"a":[1,"x"],"b":{"c":null}}';
    expect(canonicalize(parseCanonical(text))).toBe(text);
  });

  it.each([
    ['{"a":1,"a":2}', "duplicate keys"],
    ['{"b":1,"a":2}', "unsorted keys"],
    ['{"a": 1}', "whitespace"],
    ['{"a":1.0}', "non-canonical number"],
    ['{"a":1e2}', "exponent"],
    ['{"a":"\\u0041"}', "unnecessary escape"],
    ['"\\u00e9"', "escaped non-ASCII"],
  ])("rejects %s (%s)", (text) => {
    expect(code(() => parseCanonical(text))).toBe("NOT_CANONICAL");
  });

  it("rejects invalid JSON and oversized input", () => {
    expect(code(() => parseCanonical("{"))).toBe("INVALID_JSON");
    expect(code(() => parseCanonical(`"${"x".repeat(100)}"`, { maxBytes: 10 }))).toBe("TOO_LARGE");
  });

  it("rejects floats that JSON.parse would accept", () => {
    expect(code(() => parseCanonical("1.5"))).toBe("NON_INTEGER_NUMBER");
  });
});

describe("normalizeNfcDeep", () => {
  it("normalises values and keys, deeply", () => {
    const out = normalizeNfcDeep({ "e\u0301": ["e\u0301", { k: "e\u0301" }] });
    expect(canonicalize(out)).toBe('{"\u00e9":["\u00e9",{"k":"\u00e9"}]}');
  });

  it("refuses to merge keys that collide after normalisation", () => {
    expect(code(() => normalizeNfcDeep({ "\u00e9": 1, "e\u0301": 2 }))).toBe("NOT_NFC");
  });

  it("keeps a JSON.parse'd __proto__ key as data (so canonicalize can reject it)", () => {
    const out = normalizeNfcDeep(JSON.parse('{"__proto__":{"x":1}}'));
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(code(() => canonicalize(out))).toBe("FORBIDDEN_KEY");
  });
});
