import { describe, expect, it } from "vitest";
import { allBandProbes, bandProbes, bandsFromHex } from "../src/bands.js";

describe("bandProbes (plan/03 §2.2)", () => {
  it("r=0 returns only the band itself", () => {
    expect(bandProbes(0x1234, 0)).toEqual([0x1234]);
  });

  it("r=1 returns 17 values (self + 16 single-bit flips)", () => {
    const p = bandProbes(0xaaaa, 1);
    expect(p).toHaveLength(17);
    expect(new Set(p).size).toBe(17);
    expect(p).toContain(0xaaaa);
  });

  it("r=2 returns 137 values", () => {
    const p = bandProbes(0, 2);
    expect(p).toHaveLength(137);
    expect(new Set(p).size).toBe(137);
  });

  it("allBandProbes covers four bands", () => {
    const bands = bandsFromHex("80025e2e7b3f972b");
    const all = allBandProbes(bands, 0);
    expect(all.band0).toEqual([bands.band0]);
    expect(all.band3).toEqual([bands.band3]);
  });
});
