// pHash band slicing + Hamming distance.
// The 64-bit phash is split into 4 disjoint 16-bit bands for multi-index candidate
// retrieval (plan/03-ALGORITHMS.md §2.2, D1 columns band0..band3 in 04-MVP-SPEC.md §5).
// INVARIANT: band scheme + probe radii + advertised max_distance are ONE decision owned
// by 03 §2.2 — never change the band width here in isolation.

export interface Bands {
  readonly band0: number; // (phash >> 48) & 0xFFFF
  readonly band1: number; // (phash >> 32) & 0xFFFF
  readonly band2: number; // (phash >> 16) & 0xFFFF
  readonly band3: number; //  phash        & 0xFFFF
}

const MASK16 = 0xffffn;

/** Split an unsigned 64-bit phash into its 4 × 16-bit bands. */
export function bandsFromU64(phash: bigint): Bands {
  return {
    band0: Number((phash >> 48n) & MASK16),
    band1: Number((phash >> 32n) & MASK16),
    band2: Number((phash >> 16n) & MASK16),
    band3: Number(phash & MASK16),
  };
}

/** Split a 16-hex phash string into bands. */
export function bandsFromHex(phash64Hex: string): Bands {
  return bandsFromU64(BigInt(`0x${phash64Hex}`));
}

/**
 * D1 stores phash64 as a SIGNED 64-bit INTEGER (03 §2.3: BigInt.asIntN(64, hash)); API
 * responses serialize the UNSIGNED value as 16 hex. These convert between the two views.
 */
export function toSignedI64(unsigned: bigint): bigint {
  return BigInt.asIntN(64, unsigned);
}
export function toUnsignedU64(signed: bigint): bigint {
  return BigInt.asUintN(64, signed);
}

/** Hamming distance between two unsigned 64-bit phashes. */
export function hammingU64(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/** Hamming distance between two 16-hex phash strings. */
export function hammingHex(aHex: string, bHex: string): number {
  return hammingU64(BigInt(`0x${aHex}`), BigInt(`0x${bHex}`));
}
