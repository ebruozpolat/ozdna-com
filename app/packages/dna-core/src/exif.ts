// Minimal JPEG EXIF Orientation reader — plan/03 §1.3 step 0.
// Only tag 0x0112 (Orientation). No GPS, no full EXIF parser.
// Returns 1 when tag absent or unreadable (treat as "already display-oriented").

import type { Orientation } from "./orient.js";

function u16(view: DataView, offset: number, le: boolean): number {
  return le ? view.getUint16(offset, true) : view.getUint16(offset, false);
}

function u32(view: DataView, offset: number, le: boolean): number {
  return le ? view.getUint32(offset, true) : view.getUint32(offset, false);
}

/**
 * Read TIFF Orientation (1–8) from a JPEG byte buffer.
 * Scans APP1/Exif. Non-JPEG or missing tag → 1.
 */
export function readJpegOrientation(bytes: Uint8Array): Orientation {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;

  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1]!;
    i += 2;
    if (marker === 0xd9 || marker === 0xda) break; // EOI / SOS
    if (i + 2 > bytes.length) break;
    const segLen = (bytes[i]! << 8) | bytes[i + 1]!;
    if (segLen < 2 || i + segLen > bytes.length) break;

    if (marker === 0xe1) {
      // APP1 — look for Exif\0\0
      const start = i + 2;
      const end = i + segLen;
      if (
        end - start >= 14 &&
        bytes[start] === 0x45 &&
        bytes[start + 1] === 0x78 &&
        bytes[start + 2] === 0x69 &&
        bytes[start + 3] === 0x66 &&
        bytes[start + 4] === 0x00 &&
        bytes[start + 5] === 0x00
      ) {
        const o = parseTiffOrientation(bytes.subarray(start + 6, end));
        if (o !== null) return o;
      }
    }
    i += segLen;
  }
  return 1;
}

function parseTiffOrientation(tiff: Uint8Array): Orientation | null {
  if (tiff.length < 8) return null;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const le = tiff[0] === 0x49 && tiff[1] === 0x49; // II
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d; // MM
  if (!le && !be) return null;
  if (u16(view, 2, le) !== 42) return null;
  const ifd = u32(view, 4, le);
  // Walk first IFD only (primary image)
  if (ifd + 2 > tiff.length) return null;
  const count = u16(view, ifd, le);
  for (let e = 0; e < count; e++) {
    const off = ifd + 2 + e * 12;
    if (off + 12 > tiff.length) break;
    const tag = u16(view, off, le);
    const type = u16(view, off + 2, le);
    const num = u32(view, off + 4, le);
    if (tag === 0x0112 && type === 3 && num >= 1) {
      // SHORT — value inline in next 4 bytes (first 2)
      const val = u16(view, off + 8, le);
      if (val >= 1 && val <= 8) return val as Orientation;
    }
  }
  return null;
}
