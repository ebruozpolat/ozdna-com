// OzDNA Merkle tree — normative per plan/03-ALGORITHMS.md §3.2/§3.3.
//   leaf = SHA-256( 0x00 ‖ leaf_preimage )
//   node = SHA-256( 0x01 ‖ left ‖ right )
// Leaves are ordered by leaf_index (assigned in `registered_at, id` order at batch build).
// Pair left-to-right; an odd trailing node is PROMOTED UNCHANGED (never duplicated —
// duplication is Bitcoin's CVE-2012-2459 mutation bug). 0x00/0x01 domain separation
// (RFC 6962 style) blocks second-preimage games between leaves and interior nodes.

import { concatBytes, sha256, toHex } from "./sha256.js";

const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);

/** Hash a leaf preimage: SHA-256(0x00 ‖ preimage). */
export function hashLeaf(preimage: Uint8Array): Promise<Uint8Array> {
  return sha256(concatBytes(LEAF_PREFIX, preimage));
}

/** Hash an interior node: SHA-256(0x01 ‖ left ‖ right). */
export function hashNode(left: Uint8Array, right: Uint8Array): Promise<Uint8Array> {
  return sha256(concatBytes(NODE_PREFIX, left, right));
}

export interface MerkleTree {
  /** layer 0 = leaf hashes (already SHA-256(0x00‖preimage)); last layer = [root]. */
  readonly layers: Uint8Array[][];
  readonly root: Uint8Array;
  readonly leafCount: number;
}

/** Build a tree from ALREADY-HASHED leaves (each = hashLeaf(preimage)). */
export async function buildTree(leafHashes: Uint8Array[]): Promise<MerkleTree> {
  if (leafHashes.length === 0) throw new Error("cannot build a Merkle tree with 0 leaves");
  const layers: Uint8Array[][] = [leafHashes.slice()];
  let level = leafHashes;
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1];
      // odd trailing node: promote unchanged
      next.push(right === undefined ? left : await hashNode(left, right));
    }
    layers.push(next);
    level = next;
  }
  return { layers, root: layers[layers.length - 1]![0]!, leafCount: leafHashes.length };
}

export interface ProofStep {
  readonly pos: "left" | "right";
  readonly hash: string; // hex of the sibling
}

/** Inclusion proof (leaf→root) for the leaf at `index`. Promoted (sibling-less) levels add no step. */
export function merkleProof(tree: MerkleTree, index: number): ProofStep[] {
  if (index < 0 || index >= tree.leafCount) throw new Error("leaf index out of range");
  const proof: ProofStep[] = [];
  let idx = index;
  for (let l = 0; l < tree.layers.length - 1; l++) {
    const layer = tree.layers[l]!;
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    const sibling = layer[siblingIdx];
    if (sibling !== undefined) {
      // sibling on the opposite side of the current node
      proof.push({ pos: isRight ? "left" : "right", hash: toHex(sibling) });
    }
    idx = Math.floor(idx / 2);
  }
  return proof;
}

/** Fold a leaf hash up through the proof and return the reconstructed root hex. */
export async function foldProof(leafHash: Uint8Array, proof: ProofStep[]): Promise<string> {
  let acc = leafHash;
  for (const step of proof) {
    const sibling = fromHexLocal(step.hash);
    acc = step.pos === "left" ? await hashNode(sibling, acc) : await hashNode(acc, sibling);
  }
  return toHex(acc);
}

/** True iff the proof reconstructs `rootHex` from `leafHash`. */
export async function verifyProof(
  leafHash: Uint8Array,
  proof: ProofStep[],
  rootHex: string,
): Promise<boolean> {
  return (await foldProof(leafHash, proof)) === rootHex.toLowerCase();
}

function fromHexLocal(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
