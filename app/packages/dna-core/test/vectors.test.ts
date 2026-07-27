// Canonical vector regression: dna-core must reproduce the committed fixtures/vectors.json
// byte-for-byte. A mismatch means the hash math changed (breaks cross-impl matching) — the
// committed file is the reference third-party implementations check against.
// (Regenerate intentionally only; the fixture was produced by dna-core itself.)
import { describe, expect, it } from "vitest";
import { bandsFromHex } from "../src/bands.js";
import { type LeafRecord, leafPreimage } from "../src/leaf.js";
import { buildTree, hashLeaf, merkleProof, verifyProof } from "../src/merkle.js";
import { phashFromRgba } from "../src/phash.js";
import { toHex } from "../src/sha256.js";
import vectorsJson from "./fixtures/vectors.json";

const vectors = vectorsJson as unknown as {
  merkle: {
    records: LeafRecord[];
    leafHashes: string[];
    root: string;
    proofIndex: number;
    proof: { pos: "left" | "right"; hash: string }[];
  };
  phash: { name: string; w: number; h: number; expr: string; phash: string }[];
  bandsOfFirst: { band0: number; band1: number; band2: number; band3: number };
};

function makeRgba(w: number, h: number, f: (x: number, y: number) => number): Uint8Array {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, Math.round(f(x, y))));
      const p = (y * w + x) * 4;
      rgba[p] = v;
      rgba[p + 1] = v;
      rgba[p + 2] = v;
      rgba[p + 3] = 255;
    }
  return rgba;
}
const fns: Record<string, (x: number, y: number) => number> = {
  "(x+y)*4": (x, y) => (x + y) * 4,
  "x*16": (x) => x * 16,
  "20+((x*3+y*2)%100)": (x, y) => 20 + ((x * 3 + y * 2) % 100),
};

describe("canonical vectors (plan/03 §3 Merkle, §1.3 pHash)", () => {
  it("reproduces every leaf hash and the Merkle root", async () => {
    const { records, leafHashes, root } = vectors.merkle;
    const hashes: Uint8Array[] = [];
    for (let i = 0; i < records.length; i++) {
      const h = await hashLeaf(leafPreimage(records[i]!));
      expect(toHex(h), `leaf ${i}`).toBe(leafHashes[i]);
      hashes.push(h);
    }
    const tree = await buildTree(hashes);
    expect(toHex(tree.root)).toBe(root);
  });

  it("reproduces the committed inclusion proof and it verifies to the root", async () => {
    const { records, proofIndex, proof, root } = vectors.merkle;
    const hashes = await Promise.all(records.map((r) => hashLeaf(leafPreimage(r))));
    const tree = await buildTree(hashes);
    expect(merkleProof(tree, proofIndex)).toEqual(proof);
    expect(await verifyProof(hashes[proofIndex]!, proof, root)).toBe(true);
  });

  it("reproduces every pHash vector", () => {
    for (const c of vectors.phash) {
      const fn = fns[c.expr];
      expect(fn, `generator ${c.expr}`).toBeDefined();
      expect(phashFromRgba(makeRgba(c.w, c.h, fn!), c.w, c.h), c.name).toBe(c.phash);
    }
  });

  it("reproduces the band slicing of the first pHash", () => {
    expect(bandsFromHex(vectors.phash[0]!.phash)).toEqual(vectors.bandsOfFirst);
  });
});

// NOTE (deferred, ledger C5): these vectors lock dna-core's MATH (RGBA→hash, preimage→root).
// The corpus §7 also mandates real golden IMAGES (JPEG/PNG incl. one with EXIF Orientation=6,
// cross-decoder d≤2). That needs the platform decode layer (browser createImageBitmap /
// Workers @cf-wasm/photon), which isn't built yet — so the EXIF step-0 path stays UNTESTED.
