// Multi-index probe generation (plan/03-ALGORITHMS.md §2.2). Pure — no drizzle/D1 import — so
// it is unit-testable in node and reused by the D1 repo. The band scheme (4×16-bit) and the
// radius→completeness mapping are ONE decision owned by 03 §2.2: r=0 complete for d≤3, r=1 for
// d≤7, r=2 for d≤10 (pigeonhole: total distance ≤ d ⇒ some band differs by ≤ ⌊d/4⌋).

/** All 16-bit values within Hamming distance `radius` of `value` (the per-band probe set). */
export function bandNeighbors(value: number, radius: number): number[] {
  const v0 = value & 0xffff;
  const out = new Set<number>([v0]);
  const flip = (base: number, startBit: number, depth: number): void => {
    if (depth === 0) return;
    for (let b = startBit; b < 16; b++) {
      const v = base ^ (1 << b);
      out.add(v);
      flip(v, b + 1, depth - 1);
    }
  };
  flip(v0, 0, radius);
  return [...out];
}
