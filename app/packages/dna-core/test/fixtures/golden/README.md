# Golden-image corpus — OzDNA pHash v1 (C5)

Spec: `plan/03-ALGORITHMS.md` §1.3, `plan/09-DEV-SETUP.md` §7.

| File | Role |
|---|---|
| `01-gradient.png` … `04-stripes-v.png` | PNG structure variety |
| `03-near-flat.png` | Median-tie degenerate (SHOULD) |
| `05-radial.jpg` | JPEG Orientation=1 |
| `06-portrait-orient6.jpg` | **MUST** — EXIF Orientation=6 (step-0 catch) |
| `expected-hashes.json` | Locked phash16 + dimensions |

**Decode path under test:** `jpeg-js` / `pngjs` (no auto-orient) → `readJpegOrientation` + `applyOrientation` → `phashFromRgba`.

**Cross-decoder:** Workers `@cf-wasm/photon` must match within Hamming **d ≤ 2** once wired; same-family exact.

Regenerate (intentional only):

```bash
cd app/packages/dna-core && npx tsx scripts/generate-golden.mts
```

Commit binaries + `expected-hashes.json` together.
