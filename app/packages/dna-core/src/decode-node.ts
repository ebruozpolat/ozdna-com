// Node/test decoder path — JPEG via jpeg-js, PNG via pngjs.
// Does NOT auto-apply EXIF orientation (that is step 0 via orient.ts).
// Workers production path uses @cf-wasm/photon + the same applyOrientation().

import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { readJpegOrientation } from "./exif.js";
import { applyOrientation, type OrientedRgba } from "./orient.js";

export type DecodedImage = {
  readonly data: Uint8Array; // RGBA, as stored in file (pre-orient)
  readonly width: number;
  readonly height: number;
  /** Orientation tag from JPEG EXIF; PNG always 1. */
  readonly fileOrientation: number;
};

export function decodeImageBytes(bytes: Uint8Array, mimeHint?: "image/jpeg" | "image/png"): DecodedImage {
  const isJpeg =
    mimeHint === "image/jpeg" ||
    (bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (!mimeHint && looksJpeg(bytes));
  const isPng =
    mimeHint === "image/png" ||
    (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47);

  if (isJpeg) {
    const decoded = jpeg.decode(Buffer.from(bytes), { useTArray: true, formatAsRGBA: true });
    return {
      data: new Uint8Array(decoded.data),
      width: decoded.width,
      height: decoded.height,
      fileOrientation: readJpegOrientation(bytes),
    };
  }
  if (isPng) {
    const png = PNG.sync.read(Buffer.from(bytes));
    return {
      data: new Uint8Array(png.data),
      width: png.width,
      height: png.height,
      fileOrientation: 1,
    };
  }
  throw new Error("decodeImageBytes: unsupported image (need JPEG or PNG)");
}

function looksJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** Decode file bytes → apply EXIF Orientation → display-oriented RGBA (steps 0–1). */
export function decodeAndOrient(bytes: Uint8Array, mimeHint?: "image/jpeg" | "image/png"): OrientedRgba {
  const raw = decodeImageBytes(bytes, mimeHint);
  return applyOrientation(raw.data, raw.width, raw.height, raw.fileOrientation);
}
