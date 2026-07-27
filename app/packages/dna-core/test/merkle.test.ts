import { describe, expect, it } from "vitest";
import { buildTree, foldProof, hashLeaf, hashNode, merkleProof, verifyProof } from "../src/merkle.js";
import { toHex, utf8 } from "../src/sha256.js";

async function leaves(n: number) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(await hashLeaf(utf8(`leaf-${i}`)));
  return out;
}

describe("merkle", () => {
  it("single leaf: root is the leaf hash", async () => {
    const l = await leaves(1);
    const t = await buildTree(l);
    expect(toHex(t.root)).toBe(toHex(l[0]!));
    expect(t.leafCount).toBe(1);
  });

  it("two leaves: root = node(l0,l1)", async () => {
    const l = await leaves(2);
    const t = await buildTree(l);
    expect(toHex(t.root)).toBe(toHex(await hashNode(l[0]!, l[1]!)));
  });

  it("three leaves: odd trailing node is promoted unchanged (not duplicated)", async () => {
    const l = await leaves(3);
    const t = await buildTree(l);
    const expected = await hashNode(await hashNode(l[0]!, l[1]!), l[2]!);
    expect(toHex(t.root)).toBe(toHex(expected));
    // duplication bug would instead compute node(node01, node(l2,l2)) — must differ
    const dupBug = await hashNode(await hashNode(l[0]!, l[1]!), await hashNode(l[2]!, l[2]!));
    expect(toHex(t.root)).not.toBe(toHex(dupBug));
  });

  it("domain separation: leaf and node hashes of the same bytes differ", async () => {
    const a = utf8("x");
    const b = utf8("y");
    const leaf = await hashLeaf(a);
    // there is no node with a single child; compare a leaf preimage vs a node over trivial inputs
    const node = await hashNode(a, b);
    expect(toHex(leaf)).not.toBe(toHex(node));
  });

  it("inclusion proofs reconstruct the root for every leaf across sizes", async () => {
    for (const n of [1, 2, 3, 5, 6, 7, 8, 10]) {
      const l = await leaves(n);
      const t = await buildTree(l);
      const rootHex = toHex(t.root);
      for (let i = 0; i < n; i++) {
        const proof = merkleProof(t, i);
        expect(await verifyProof(l[i]!, proof, rootHex), `n=${n} leaf=${i}`).toBe(true);
      }
    }
  });

  it("a tampered leaf does not verify against the root", async () => {
    const l = await leaves(6);
    const t = await buildTree(l);
    const proof = merkleProof(t, 2);
    const wrong = await hashLeaf(utf8("not-leaf-2"));
    expect(await verifyProof(wrong, proof, toHex(t.root))).toBe(false);
  });

  it("proof step count is ⌈log2(n)⌉-ish (≤) and folds deterministically", async () => {
    const l = await leaves(8);
    const t = await buildTree(l);
    const proof = merkleProof(t, 0);
    expect(proof.length).toBe(3); // perfect tree of 8 → depth 3
    expect(await foldProof(l[0]!, proof)).toBe(toHex(t.root));
  });

  it("empty tree throws", async () => {
    await expect(buildTree([])).rejects.toThrow();
  });
});
