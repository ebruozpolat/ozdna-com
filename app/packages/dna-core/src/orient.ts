// EXIF Orientation apply — plan/03-ALGORITHMS.md §1.3 step 0 (Workers path).
// Browser uses createImageBitmap(..., { imageOrientation: 'from-image' }); Workers
// decode via photon WITHOUT auto-orient, then call applyOrientation() here.
// Values 1–8 per JEITA CP-3451 / TIFF Orientation tag.

export type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type OrientedRgba = {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly orientationApplied: Orientation;
};

function copyPixel(
  src: Uint8Array | Uint8ClampedArray,
  sw: number,
  sx: number,
  sy: number,
  dst: Uint8Array,
  dw: number,
  dx: number,
  dy: number,
): void {
  const si = (sy * sw + sx) * 4;
  const di = (dy * dw + dx) * 4;
  dst[di] = src[si]!;
  dst[di + 1] = src[si + 1]!;
  dst[di + 2] = src[si + 2]!;
  dst[di + 3] = src[si + 3]!;
}

/**
 * Transform stored (file) pixels into display-oriented RGBA.
 * Orientation 1 is a no-op copy. Dimensions swap for 5–8.
 */
export function applyOrientation(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  orientation: number,
): OrientedRgba {
  const o = (orientation >= 1 && orientation <= 8 ? orientation : 1) as Orientation;
  if (o === 1) {
    return {
      data: rgba instanceof Uint8Array ? rgba.slice() : new Uint8Array(rgba),
      width,
      height,
      orientationApplied: 1,
    };
  }

  const swap = o >= 5;
  const dw = swap ? height : width;
  const dh = swap ? width : height;
  const out = new Uint8Array(dw * dh * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let dx: number;
      let dy: number;
      switch (o) {
        case 2: // flip H
          dx = width - 1 - x;
          dy = y;
          break;
        case 3: // 180
          dx = width - 1 - x;
          dy = height - 1 - y;
          break;
        case 4: // flip V
          dx = x;
          dy = height - 1 - y;
          break;
        case 5: // transpose (flip H + rotate 90 CW) — mirror over main diagonal then…
          // TIFF 5: transpose
          dx = y;
          dy = x;
          break;
        case 6: // rotate 90 CW
          dx = height - 1 - y;
          dy = x;
          break;
        case 7: // transverse
          dx = height - 1 - y;
          dy = width - 1 - x;
          break;
        case 8: // rotate 90 CCW
          dx = y;
          dy = width - 1 - x;
          break;
        default:
          dx = x;
          dy = y;
      }
      copyPixel(rgba, width, x, y, out, dw, dx, dy);
    }
  }

  return { data: out, width: dw, height: dh, orientationApplied: o };
}
