/**
 * Browser C2PA verify — @contentauth/c2pa-web Wasm.
 * Never claim official trust-list status (ozDNA hard rule 5).
 */

import { createC2pa } from "@contentauth/c2pa-web";
import wasmSrc from "@contentauth/c2pa-web/resources/c2pa.wasm?url";

export type C2paVerifyResult =
  | { ok: true; hasManifest: true; summary: string; raw: unknown }
  | { ok: true; hasManifest: false; summary: string }
  | { ok: false; summary: string; error: string };

let c2paPromise: ReturnType<typeof createC2pa> | null = null;

function getC2pa() {
  if (!c2paPromise) c2paPromise = createC2pa({ wasmSrc });
  return c2paPromise;
}

export async function verifyC2pa(file: File): Promise<C2paVerifyResult> {
  const mime = file.type || "application/octet-stream";
  if (mime !== "image/jpeg" && mime !== "image/png") {
    return {
      ok: false,
      summary: "v1 verifies JPG/PNG only.",
      error: "unsupported_type",
    };
  }

  try {
    const c2pa = await getC2pa();
    const reader = await c2pa.reader.fromBlob(mime, file);
    if (!reader) {
      return {
        ok: true,
        hasManifest: false,
        summary:
          "No C2PA manifest found. Most web images are unsigned — that does not mean they are fake.",
      };
    }
    try {
      const store = await reader.manifestStore();
      const active = (store as { active?: { label?: string; claim_generator?: string } })?.active;
      const label = active?.label ?? "manifest";
      const gen = active?.claim_generator ?? "unknown generator";
      return {
        ok: true,
        hasManifest: true,
        summary: `Manifest present (${label}). Claim generator: ${gen}. Cryptographic structure readable in-browser — this is NOT an official Content Credentials trust-list verdict.`,
        raw: store,
      };
    } finally {
      await reader.free();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Broken/tampered manifests often throw — surface honestly.
    if (/signatur|valid|manifest|c2pa/i.test(msg)) {
      return {
        ok: false,
        summary:
          "A C2PA structure was detected but could not be validated (broken or unsupported). No trust-list claim is made.",
        error: msg,
      };
    }
    return { ok: false, summary: "C2PA reader failed.", error: msg };
  }
}
