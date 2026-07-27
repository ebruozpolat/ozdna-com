import { describe, expect, it } from "vitest";
import {
  bandsFromHex,
  bandsFromU64,
  hammingHex,
  hammingU64,
  toSignedI64,
  toUnsignedU64,
} from "../src/bands.js";

describe("bands + hamming (03 §2.2)", () => {
  it("slices a 64-bit value into 4 × 16-bit bands", () => {
    const v = 0x0123456789abcdefn;
    expect(bandsFromU64(v)).toEqual({
      band0: 0x0123,
      band1: 0x4567,
      band2: 0x89ab,
      band3: 0xcdef,
    });
  });

  it("bandsFromHex matches bandsFromU64", () => {
    expect(bandsFromHex("0123456789abcdef")).toEqual(bandsFromU64(0x0123456789abcdefn));
  });

  it("signed/unsigned i64 round-trips (D1 stores signed, API serializes unsigned)", () => {
    const unsigned = 0xffffffffffffffffn; // all ones
    const signed = toSignedI64(unsigned);
    expect(signed).toBe(-1n);
    expect(toUnsignedU64(signed)).toBe(unsigned);
  });

  it("hamming distance", () => {
    expect(hammingU64(0n, 0n)).toBe(0);
    expect(hammingU64(0n, 0xffffffffffffffffn)).toBe(64);
    expect(hammingHex("0000000000000000", "0000000000000001")).toBe(1);
    expect(hammingHex("0000000000000000", "000000000000000f")).toBe(4);
  });
});
