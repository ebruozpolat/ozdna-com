// Workers/Node photon decode — plan/03 §1.3 step 1.
// Photon does NOT apply EXIF Orientation; call applyOrientation after this (step 0).
// Package pin: @cf-wasm/photon 0.3.6 (plan/02).

import { initPhoton, PhotonImage, photonWasmModule } from "@cf-wasm/photon/node";
import { readJpegOrientation } from "./exif.js";
import { applyOrientation, type OrientedRgba } from "./orient.js";

let photonReady: Promise<void> | null = null;

/** Idempotent — @cf-wasm/photon allows initPhoton only once per isolate. */
export function initPhotonDecode(): Promise<void> {
  if (!photonReady) {
    photonReady = (async () => {
      if (initPhoton.ready || initPhoton.initialized) {
        await initPhoton.ensure();
        return;
      }
      try {
        await initPhoton({ module_or_path: photonWasmModule });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/already called|only once/i.test(msg)) throw e;
        await initPhoton.ensure();
      }
    })();
  }
  return photonReady;
}

export type PhotonDecoded = {
  readonly data: Uint8Array; // RGBA, file storage orientation
  readonly width: number;
  readonly height: number;
};

/** Decode JPEG/PNG bytes to RGBA via photon (no EXIF auto-orient). */
export async function decodeWithPhoton(bytes: Uint8Array): Promise<PhotonDecoded> {
  await initPhotonDecode();
  const img = PhotonImage.new_from_byteslice(bytes);
  try {
    const width = img.get_width();
    const height = img.get_height();
    const data = new Uint8Array(img.get_raw_pixels());
    return { data, width, height };
  } finally {
    img.free();
  }
}

/** Photon decode + EXIF Orientation apply (Workers production path). */
export async function decodeAndOrientPhoton(bytes: Uint8Array): Promise<OrientedRgba> {
  const raw = await decodeWithPhoton(bytes);
  const orientation = bytes[0] === 0xff && bytes[1] === 0xd8 ? readJpegOrientation(bytes) : 1;
  return applyOrientation(raw.data, raw.width, raw.height, orientation);
}
