import { describe, expect, it } from "vitest";
import { bandNeighbors } from "../src/repo/probe.js";

const popcount = (x: number) => {
  let c = 0;
  for (let i = 0; i < 16; i++) c += (x >> i) & 1;
  return c;
};

describe("bandNeighbors (multi-index probe, §2.2)", () => {
  it("radius 0 is just the value itself", () => {
    expect(bandNeighbors(0x1234, 0)).toEqual([0x1234]);
  });

  it("radius 1 yields 1 + 16 single-bit flips (17 values)", () => {
    const n = bandNeighbors(0x0000, 1);
    expect(new Set(n).size).toBe(17);
    // every neighbor is within Hamming distance 1 of 0
    for (const v of n) expect(popcount(v)).toBeLessThanOrEqual(1);
  });

  it("radius 2 yields 1 + 16 + C(16,2)=120 = 137 values, all within distance 2", () => {
    const n = bandNeighbors(0x0000, 2);
    expect(new Set(n).size).toBe(137);
    for (const v of n) expect(popcount(v ^ 0x0000)).toBeLessThanOrEqual(2);
  });

  it("masks to 16 bits", () => {
    for (const v of bandNeighbors(0xffff, 1)) expect(v).toBeLessThanOrEqual(0xffff);
  });
});
