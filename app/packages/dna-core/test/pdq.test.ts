import { describe, expect, it } from "vitest";
import {
  PDQ_CONFIRM_MAX,
  PDQ_HASH_BITS,
  PDQ_HASH_BYTES,
  pdq256FromHex,
  pdq256ToHex,
  pdqConfirms,
  pdqDistance,
  scorePdq,
} from "../src/pdq.js";
import { THRESHOLDS } from "../src/verdict.js";

const zeros = () => new Uint8Array(PDQ_HASH_BYTES);
const ones = () => new Uint8Array(PDQ_HASH_BYTES).fill(0xff);

describe("pdq constants", () => {
  it("is 32 bytes / 256 bits", () => {
    expect(PDQ_HASH_BYTES).toBe(32);
    expect(PDQ_HASH_BITS).toBe(256);
    expect(PDQ_HASH_BYTES * 8).toBe(PDQ_HASH_BITS);
  });

  it("confirm threshold stays in lockstep with the verdict layer", () => {
    // Single source of truth: pdq.ts owns the number; verdict.ts must not drift from it.
    expect(PDQ_CONFIRM_MAX).toBe(31);
    expect(THRESHOLDS.pdqConfirm).toBe(PDQ_CONFIRM_MAX);
  });
});

describe("pdqDistance", () => {
  it("is 0 for identical hashes", () => {
    expect(pdqDistance(zeros(), zeros())).toBe(0);
    expect(pdqDistance(ones(), ones())).toBe(0);
  });

  it("is 256 for bit-opposite hashes", () => {
    expect(pdqDistance(zeros(), ones())).toBe(PDQ_HASH_BITS);
  });

  it("counts differing bits exactly", () => {
    // one byte differs by 0b1011 (3 bits): 0x00 vs 0x0b
    const a = zeros();
    const b = zeros();
    b[0] = 0x0b;
    expect(pdqDistance(a, b)).toBe(3);
    // add another differing byte 0xff (8 bits) → 11 total
    b[31] = 0xff;
    expect(pdqDistance(a, b)).toBe(11);
  });

  it("is symmetric", () => {
    const a = pdq256FromHex("a".repeat(64));
    const b = pdq256FromHex("5".repeat(64));
    expect(pdqDistance(a, b)).toBe(pdqDistance(b, a));
  });

  it("rejects wrong-length inputs", () => {
    expect(() => pdqDistance(new Uint8Array(31), zeros())).toThrow(/32 bytes/);
    expect(() => pdqDistance(zeros(), new Uint8Array(33))).toThrow(/32 bytes/);
  });
});

describe("pdqConfirms", () => {
  it("confirms at and below 31, rejects above", () => {
    expect(pdqConfirms(0)).toBe(true);
    expect(pdqConfirms(31)).toBe(true);
    expect(pdqConfirms(32)).toBe(false);
    expect(pdqConfirms(256)).toBe(false);
  });

  it("honours a custom threshold", () => {
    expect(pdqConfirms(10, 6)).toBe(false);
    expect(pdqConfirms(6, 6)).toBe(true);
  });
});

describe("hex encoding", () => {
  it("round-trips bytes → hex → bytes", () => {
    const bytes = pdq256FromHex("9555fd00015ffd40ad5557ea0aff55aa0055552a5542007f554a01575555ffff");
    expect(pdq256ToHex(bytes)).toBe(
      "9555fd00015ffd40ad5557ea0aff55aa0055552a5542007f554a01575555ffff",
    );
    expect(bytes.length).toBe(PDQ_HASH_BYTES);
  });

  it("emits 64 lowercase hex chars", () => {
    const hex = pdq256ToHex(ones());
    expect(hex).toBe("f".repeat(64));
    expect(hex).toHaveLength(64);
  });

  it("rejects malformed hex", () => {
    expect(() => pdq256FromHex("abc")).toThrow(/64 hex/);
    expect(() => pdq256FromHex("g".repeat(64))).toThrow(/64 hex/);
    expect(() => pdq256FromHex("a".repeat(63))).toThrow(/64 hex/);
  });

  it("rejects wrong-length bytes on encode", () => {
    expect(() => pdq256ToHex(new Uint8Array(16))).toThrow(/32 bytes/);
  });
});

describe("scorePdq", () => {
  it("returns distance + confirmed together", () => {
    expect(scorePdq(zeros(), zeros())).toEqual({ distance: 0, confirmed: true });
    expect(scorePdq(zeros(), ones())).toEqual({ distance: 256, confirmed: false });
  });

  it("confirms right at the 31-bit boundary", () => {
    const a = zeros();
    const b = zeros();
    // set exactly 31 bits across the first 4 bytes: 0xff,0xff,0xff (24) + 0x7f (7) = 31
    b[0] = 0xff;
    b[1] = 0xff;
    b[2] = 0xff;
    b[3] = 0x7f;
    const s = scorePdq(a, b);
    expect(s.distance).toBe(31);
    expect(s.confirmed).toBe(true);
    b[3] = 0xff; // 32 bits → over threshold
    expect(scorePdq(a, b).confirmed).toBe(false);
  });
});
