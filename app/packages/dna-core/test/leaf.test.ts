import { describe, expect, it } from "vitest";
import { leafPreimage } from "../src/leaf.js";
import { hashLeaf } from "../src/merkle.js";
import { toHex } from "../src/sha256.js";

const rec = {
  id: "rec_01JZX3E8LKWY2P4QD9T7RM5HBF",
  sha256Hex: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  phash64Hex: "c4a2b1d8e0f39a57",
  pdq256Hex: null,
  manifestSha256Hex: null,
  accountId: "usr_01JZX0",
  registeredAt: "2026-10-14T09:31:02.417Z",
};

describe("leaf preimage (03 §3.2)", () => {
  it("serializes to the exact newline-delimited template with absent fields as empty", () => {
    const expected =
      "ozdna.v1\n" +
      "rec_01JZX3E8LKWY2P4QD9T7RM5HBF\n" +
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08\n" +
      "c4a2b1d8e0f39a57\n" +
      "\n" + // pdq256 absent
      "\n" + // manifest_sha256 absent
      "usr_01JZX0\n" +
      "2026-10-14T09:31:02.417Z\n";
    expect(new TextDecoder().decode(leafPreimage(rec))).toBe(expected);
  });

  it("is deterministic and hashes as a leaf without throwing", async () => {
    const a = leafPreimage(rec);
    const b = leafPreimage(rec);
    expect(toHex(a)).toBe(toHex(b));
    const h = await hashLeaf(a);
    expect(h.length).toBe(32);
  });

  it("changing any field changes the preimage", () => {
    const base = new TextDecoder().decode(leafPreimage(rec));
    const changed = new TextDecoder().decode(leafPreimage({ ...rec, id: "rec_other" }));
    expect(changed).not.toBe(base);
  });
});
