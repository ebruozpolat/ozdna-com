// OzDNA pHash v1 — normative per plan/03-ALGORITHMS.md §1.3.
// This module owns steps 2–7 (luma → 32×32 area-average → DCT-II → top-left 8×8 →
// median threshold → MSB-first packing). Steps 0–1 (EXIF orientation + decode to RGBA)
// are platform-specific (browser createImageBitmap / Workers @cf-wasm/photon) and feed
// pixels in here. ONE implementation, shared by browser and Workers — a one-bit drift
// between two impls destroys matching (architectural invariant, plan/01 §1, 03 §1).

const SIZE = 32; // downscale target
const KEEP = 8; // top-left DCT block kept (64 coefficients)

/**
 * Rec. 601 luma from RGBA bytes, compositing alpha over white first.
 * @returns Float64 luma, length width*height, row-major.
 */
export function lumaFromRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Float64Array {
  if (rgba.length < width * height * 4) throw new Error("rgba shorter than width*height*4");
  const out = new Float64Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const r = rgba[p * 4]!;
    const g = rgba[p * 4 + 1]!;
    const b = rgba[p * 4 + 2]!;
    const a = rgba[p * 4 + 3]! / 255;
    const rr = r * a + 255 * (1 - a);
    const gg = g * a + 255 * (1 - a);
    const bb = b * a + 255 * (1 - a);
    out[p] = 0.299 * rr + 0.587 * gg + 0.114 * bb;
  }
  return out;
}

/**
 * Area-average (box) downscale of a luma plane to 32×32, with fractional edge coverage.
 * Our own resampler — never the platform's (canvas scaling is not cross-browser identical).
 * @returns Float64 length 32*32, row-major [row i][col j].
 */
export function boxDownscale32(luma: Float64Array, width: number, height: number): Float64Array {
  const out = new Float64Array(SIZE * SIZE);
  for (let i = 0; i < SIZE; i++) {
    const y0 = (i * height) / SIZE;
    const y1 = ((i + 1) * height) / SIZE;
    for (let j = 0; j < SIZE; j++) {
      const x0 = (j * width) / SIZE;
      const x1 = ((j + 1) * width) / SIZE;
      let sum = 0;
      let wsum = 0;
      for (let y = Math.floor(y0); y < Math.min(height, Math.ceil(y1)); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        if (wy <= 0) continue;
        for (let x = Math.floor(x0); x < Math.min(width, Math.ceil(x1)); x++) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0);
          if (wx <= 0) continue;
          const w = wy * wx;
          sum += luma[y * width + x]! * w;
          wsum += w;
        }
      }
      out[i * SIZE + j] = wsum > 0 ? sum / wsum : 0;
    }
  }
  return out;
}

// Cosine table for DCT-II — HARDCODED Float64 literals (not Math.cos at runtime).
// Math.cos platform libm differences flip median-threshold bits (CI Linux vs macOS
// disagreed on vectors.json diag-32). The table is the normative constant; regenerating
// it means regenerating fixtures/vectors.json in the same commit.
const COS: readonly (readonly number[])[] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0.9987954562051724,0.989176509964781,0.970031253194544,0.9415440651830208,0.9039892931234433,0.8577286100002721,0.8032075314806449,0.7409511253549592,0.6715589548470183,0.5956993044924335,0.5141027441932217,0.4275550934302822,0.33688985339222005,0.24298017990326398,0.14673047445536175,0.049067674327418126,-0.04906767432741801,-0.14673047445536164,-0.24298017990326387,-0.33688985339221994,-0.42755509343028186,-0.5141027441932216,-0.5956993044924334,-0.6715589548470184,-0.7409511253549589,-0.8032075314806448,-0.857728610000272,-0.9039892931234433,-0.9415440651830207,-0.970031253194544,-0.989176509964781,-0.9987954562051724],
  [0.9951847266721969,0.9569403357322088,0.881921264348355,0.773010453362737,0.6343932841636455,0.4713967368259978,0.29028467725446233,0.09801714032956077,-0.09801714032956065,-0.29028467725446216,-0.4713967368259977,-0.6343932841636454,-0.773010453362737,-0.8819212643483549,-0.9569403357322088,-0.9951847266721968,-0.9951847266721969,-0.9569403357322089,-0.881921264348355,-0.7730104533627371,-0.6343932841636459,-0.4713967368259979,-0.29028467725446244,-0.09801714032956045,0.09801714032956009,0.29028467725446205,0.4713967368259976,0.6343932841636456,0.7730104533627365,0.8819212643483548,0.9569403357322088,0.9951847266721969],
  [0.989176509964781,0.9039892931234433,0.7409511253549592,0.5141027441932217,0.24298017990326398,-0.04906767432741801,-0.33688985339221994,-0.5956993044924334,-0.8032075314806448,-0.9415440651830207,-0.9987954562051724,-0.970031253194544,-0.8577286100002721,-0.6715589548470187,-0.4275550934302825,-0.1467304744553623,0.14673047445536194,0.42755509343028214,0.6715589548470183,0.857728610000272,0.970031253194544,0.9987954562051724,0.9415440651830209,0.8032075314806453,0.5956993044924332,0.33688985339222005,0.049067674327418154,-0.2429801799032628,-0.5141027441932214,-0.7409511253549593,-0.9039892931234431,-0.989176509964781],
  [0.9807852804032304,0.8314696123025452,0.5555702330196023,0.19509032201612833,-0.1950903220161282,-0.555570233019602,-0.8314696123025453,-0.9807852804032304,-0.9807852804032304,-0.8314696123025455,-0.5555702330196022,-0.19509032201612866,0.1950903220161283,0.5555702330196018,0.8314696123025452,0.9807852804032303,0.9807852804032304,0.8314696123025456,0.5555702330196023,0.19509032201612878,-0.1950903220161273,-0.5555702330196017,-0.8314696123025451,-0.9807852804032305,-0.9807852804032307,-0.8314696123025456,-0.5555702330196024,-0.19509032201612803,0.1950903220161272,0.5555702330196016,0.8314696123025451,0.9807852804032304],
  [0.970031253194544,0.7409511253549592,0.33688985339222005,-0.14673047445536164,-0.5956993044924334,-0.9039892931234433,-0.9987954562051724,-0.8577286100002721,-0.5141027441932218,-0.04906767432741803,0.42755509343028214,0.803207531480645,0.9891765099647809,0.9415440651830209,0.6715589548470187,0.24298017990326423,-0.2429801799032628,-0.6715589548470177,-0.9415440651830205,-0.9891765099647811,-0.8032075314806454,-0.4275550934302827,0.04906767432741742,0.5141027441932213,0.8577286100002719,0.9987954562051724,0.9039892931234434,0.5956993044924335,0.1467304744553618,-0.3368898533922201,-0.7409511253549592,-0.9700312531945441],
  [0.9569403357322088,0.6343932841636455,0.09801714032956077,-0.4713967368259977,-0.8819212643483549,-0.9951847266721969,-0.7730104533627371,-0.29028467725446244,0.29028467725446205,0.7730104533627365,0.9951847266721969,0.881921264348355,0.47139673682599803,-0.09801714032955997,-0.6343932841636448,-0.9569403357322085,-0.9569403357322087,-0.6343932841636454,-0.09801714032956069,0.47139673682599736,0.8819212643483547,0.9951847266721969,0.7730104533627377,0.2902846772544636,-0.29028467725446255,-0.7730104533627369,-0.9951847266721968,-0.8819212643483562,-0.4713967368259983,0.09801714032956137,0.6343932841636445,0.9569403357322089],
  [0.9415440651830208,0.5141027441932217,-0.14673047445536164,-0.7409511253549589,-0.9987954562051724,-0.8032075314806449,-0.24298017990326412,0.42755509343028214,0.9039892931234431,0.9700312531945441,0.5956993044924332,-0.04906767432741754,-0.6715589548470177,-0.989176509964781,-0.8577286100002723,-0.336889853392221,0.3368898533922202,0.8577286100002719,0.9891765099647811,0.6715589548470182,0.0490676743274184,-0.5956993044924326,-0.9700312531945441,-0.9039892931234434,-0.4275550934302813,0.24298017990326243,0.8032075314806447,0.9987954562051724,0.7409511253549601,0.14673047445536205,-0.5141027441932225,-0.9415440651830203],
];
// α(k) hardcoded — same portability reason as COS.
const ALPHA0 = 0.17677669529663687; // Math.sqrt(1/32)
const ALPHA1 = 0.25000000000000000; // Math.sqrt(2/32)
const ALPHA = (k: number): number => (k === 0 ? ALPHA0 : ALPHA1);

/** Top-left 8×8 orthonormal 2-D DCT-II coefficients of a 32×32 grid (row-major, 64 values). */
export function dctTopLeft(grid32: Float64Array): Float64Array {
  const c = new Float64Array(KEEP * KEEP);
  for (let u = 0; u < KEEP; u++) {
    const cu = COS[u]!;
    for (let v = 0; v < KEEP; v++) {
      const cv = COS[v]!;
      let sum = 0;
      for (let x = 0; x < SIZE; x++) {
        const cux = cu[x]!;
        const rowoff = x * SIZE;
        let inner = 0;
        for (let y = 0; y < SIZE; y++) inner += grid32[rowoff + y]! * cv[y]!;
        sum += cux * inner;
      }
      c[u * KEEP + v] = ALPHA(u) * ALPHA(v) * sum;
    }
  }
  return c;
}

/** Median of 64 coefficients = mean of the 32nd and 33rd order statistics. */
export function median64(coeffs: Float64Array): number {
  const s = Array.from(coeffs).sort((a, b) => a - b);
  return (s[31]! + s[32]!) / 2;
}

/**
 * Pack 64 coefficients into a 64-bit hash: bit(8u+v)=1 iff C>median (STRICT);
 * bit(0)=(u=0,v=0) is the MSB. Returns an unsigned BigInt in [0, 2^64).
 */
export function packHash(coeffs: Float64Array): bigint {
  const m = median64(coeffs);
  let v = 0n;
  for (let k = 0; k < 64; k++) {
    if (coeffs[k]! > m) v |= 1n << BigInt(63 - k);
  }
  return v;
}

/** 16 lowercase hex chars of an unsigned 64-bit value. */
export function hashToHex(v: bigint): string {
  return v.toString(16).padStart(16, "0");
}

/** Full OzDNA pHash v1 over decoded RGBA pixels → 16-hex string (steps 2–7). */
export function phashFromRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): string {
  const luma = lumaFromRgba(rgba, width, height);
  const grid = boxDownscale32(luma, width, height);
  const coeffs = dctTopLeft(grid);
  return hashToHex(packHash(coeffs));
}
