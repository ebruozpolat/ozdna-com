// Signed checkpoints. The API builds the checkpoint body from the verified stored chain; the
// signer (service binding) signs it; the API re-verifies the signature against the
// registered active key before storing anything.

import { buildCheckpoint, verifyCheckpointSignature } from "@ozdna/provenance-core";
import {
  canonicalize,
  checkpointSchema,
  parseCanonical,
  signatureSchema,
} from "@ozdna/provenance-schema";
import { Hono } from "hono";
import { requireScopes } from "../auth.js";
import type { Env } from "../env.js";
import { HttpError } from "../errors.js";
import { d1Stores } from "../repo/d1.js";
import type { CheckpointRow, Stores } from "../repo/stores.js";
import { loadChain } from "../service/chain.js";

export const checkpointRoutes = new Hono<{ Bindings: Env }>();

const now = () => new Date().toISOString();

function present(row: CheckpointRow) {
  return {
    checkpoint: { body: parseCanonical(row.body), digest: row.digest },
    signature: { alg: "Ed25519", key_id: row.key_id, sig: row.signature },
  };
}

async function requireProject(stores: Stores, tenantId: string, projectId: string) {
  if (!(await stores.projects.get(tenantId, projectId))) {
    throw new HttpError(404, "not_found", "PROJECT_NOT_FOUND", "No such project.");
  }
}

checkpointRoutes.post(
  "/projects/:id/checkpoints",
  requireScopes("checkpoints:write"),
  async (c) => {
    const svc = c.get("svc");
    const stores = d1Stores(c.env.PROV_DB);
    const projectId = c.req.param("id");
    await requireProject(stores, svc.tenantId, projectId);
    if (!c.env.SIGNER)
      throw new HttpError(503, "unavailable", "SIGNER_UNAVAILABLE", "Signing is not configured.");

    const activeKey = await stores.keys.active();
    if (!activeKey)
      throw new HttpError(
        503,
        "unavailable",
        "NO_ACTIVE_KEY",
        "No active signing key is registered.",
      );

    const chain = await loadChain(stores, svc.tenantId, projectId);
    if (chain.unparsable) {
      throw new HttpError(
        409,
        "conflict",
        "CHAIN_INVALID",
        "The stored chain is not valid; it cannot be checkpointed.",
      );
    }
    let built: Awaited<ReturnType<typeof buildCheckpoint>>;
    try {
      built = await buildCheckpoint(chain.events, now());
    } catch {
      throw new HttpError(
        409,
        "conflict",
        "CHAIN_INVALID",
        "The stored chain is not valid; it cannot be checkpointed.",
      );
    }

    const latest = await stores.checkpoints.latest(svc.tenantId, projectId);
    if (latest && latest.head_seq === built.body.head_seq) return c.json(present(latest), 200);

    let signed: unknown;
    try {
      signed = await c.env.SIGNER.signCheckpoint(built.body);
    } catch {
      throw new HttpError(502, "unavailable", "SIGNER_REFUSED", "The signer refused or failed.");
    }
    const parsed = {
      checkpoint: checkpointSchema.safeParse((signed as { checkpoint?: unknown })?.checkpoint),
      signature: signatureSchema.safeParse((signed as { signature?: unknown })?.signature),
    };
    if (!parsed.checkpoint.success || !parsed.signature.success) {
      throw new HttpError(
        502,
        "unavailable",
        "SIGNER_RESPONSE_INVALID",
        "The signer returned an invalid response.",
      );
    }
    const checkpoint = parsed.checkpoint.data;
    const signature = parsed.signature.data;
    // The signer must have signed exactly our body, with the registered active key.
    if (
      canonicalize(checkpoint.body) !== canonicalize(built.body) ||
      checkpoint.digest !== built.digest
    ) {
      throw new HttpError(
        502,
        "unavailable",
        "SIGNER_RESPONSE_INVALID",
        "The signer signed a different checkpoint.",
      );
    }
    if (signature.key_id !== activeKey.key_id) {
      throw new HttpError(
        503,
        "unavailable",
        "KEY_NOT_REGISTERED",
        "The signer's key is not the active registered key.",
      );
    }
    const check = await verifyCheckpointSignature(checkpoint, signature, activeKey);
    if (!check.valid) {
      throw new HttpError(
        502,
        "unavailable",
        "SIGNATURE_INVALID",
        `Signature failed verification (${check.code}).`,
      );
    }

    const row: CheckpointRow = {
      head_seq: checkpoint.body.head_seq,
      body: canonicalize(checkpoint.body),
      digest: checkpoint.digest,
      key_id: signature.key_id,
      signature: signature.sig,
    };
    try {
      await stores.uow.commit([
        stores.checkpoints.insert(svc.tenantId, projectId, {
          ...row,
          head_hash: checkpoint.body.head_hash,
          issued_at: checkpoint.body.issued_at,
        }),
      ]);
    } catch (e) {
      // A concurrent request checkpointed the same head first: return that one.
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("UNIQUE constraint failed")) throw e;
      const winner = await stores.checkpoints.latest(svc.tenantId, projectId);
      if (winner) return c.json(present(winner), 200);
      throw e;
    }
    return c.json({ ...present(row), key: activeKey }, 201);
  },
);

checkpointRoutes.get(
  "/projects/:id/checkpoints/latest",
  requireScopes("events:read"),
  async (c) => {
    const svc = c.get("svc");
    const stores = d1Stores(c.env.PROV_DB);
    const projectId = c.req.param("id");
    await requireProject(stores, svc.tenantId, projectId);
    const latest = await stores.checkpoints.latest(svc.tenantId, projectId);
    if (!latest)
      throw new HttpError(404, "not_found", "NO_CHECKPOINT", "This project has no checkpoint yet.");
    return c.json(present(latest));
  },
);
