/**
 * Browser-only C2PA verify helper for the OriginDNA SPA.
 *
 * `@contentauth/c2pa-web` is a WASM-backed browser SDK (Web Worker + Wasm).
 * It does not run in Node. Call this from client code after bundling Wasm
 * (Vite `?url` import or CDN / inline build — see package README).
 *
 * @example
 * ```ts
 * import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';
 * const store = await verifyC2pa(file, { wasmSrc });
 * ```
 */

import { createC2pa } from '@contentauth/c2pa-web';

export type VerifyC2paOptions = {
  /** URL (or Vite-resolved URL) of the c2pa Wasm binary. Required unless using the `/inline` entry. */
  wasmSrc: string;
  /** MIME type when `input` is an ArrayBuffer (default: application/octet-stream). */
  mimeType?: string;
};

/**
 * Read and return the C2PA manifest store for an image (or other supported asset).
 * Frees the underlying reader when done.
 */
export async function verifyC2pa(
  input: File | ArrayBuffer,
  options: VerifyC2paOptions,
): Promise<unknown | null> {
  const mimeType =
    input instanceof File
      ? input.type || options.mimeType || 'application/octet-stream'
      : options.mimeType || 'application/octet-stream';

  const blob =
    input instanceof File
      ? input
      : new Blob([input], { type: mimeType });

  const c2pa = await createC2pa({ wasmSrc: options.wasmSrc });
  const maybeReader = await c2pa.reader.fromBlob(mimeType, blob);
  if (!maybeReader) {
    return null;
  }
  const reader = maybeReader;
  try {
    return await reader.manifestStore();
  } finally {
    await reader.free();
  }
}
