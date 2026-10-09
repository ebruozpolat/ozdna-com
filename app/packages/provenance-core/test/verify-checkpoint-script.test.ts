// app/scripts/verify-checkpoint.mjs: the offline verifier (node:crypto only). Runs it as a
// separate process against chains and checkpoints produced by this library.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredEvent } from "@ozdna/provenance-schema";
import { describe, expect, it } from "vitest";
import { appendEvent } from "../src/chain.js";
import { buildCheckpoint } from "../src/checkpoint.js";
import { checkpointPreimage, computeEventHash } from "../src/hash.js";
import { keyIdFor, toBase64Url } from "../src/signature.js";
import { buildChain, clone, draft, fixedDrafts } from "./helpers.js";

const SCRIPT = fileURLToPath(new URL("../../../scripts/verify-checkpoint.mjs", import.meta.url));
const ISSUED = "2026-10-07T12:00:00.000Z";

async function fixture() {
  const events = await buildChain(fixedDrafts());
  const checkpoint = await buildCheckpoint(events, ISSUED);
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const keyId = await keyIdFor(raw);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "Ed25519" },
      kp.privateKey,
      checkpointPreimage(checkpoint.body) as unknown as BufferSource,
    ),
  );
  const signature = { alg: "Ed25519", key_id: keyId, sig: toBase64Url(sig) };
  const record = {
    key_id: keyId,
    algorithm: "Ed25519",
    public_key: toBase64Url(raw),
    status: "active",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_to: null,
    revoked_at: null,
  };
  return { events, checkpoint, signature, record, publicKey: toBase64Url(raw) };
}

function run(
  files: { checkpoint: unknown; events: unknown; key: string | object },
  ...flags: string[]
) {
  const dir = mkdtempSync(join(tmpdir(), "ozdna-verify-"));
  const cp = join(dir, "checkpoint.json");
  const ev = join(dir, "events.json");
  writeFileSync(cp, JSON.stringify(files.checkpoint));
  writeFileSync(ev, JSON.stringify(files.events));
  let keyArg = typeof files.key === "string" ? files.key : join(dir, "key.json");
  if (typeof files.key !== "string") writeFileSync(keyArg, JSON.stringify(files.key));
  if (typeof files.key === "string" && flags.includes("--key-file")) {
    keyArg = join(dir, "key.txt");
    writeFileSync(keyArg, `${files.key}\n`);
  }
  const r = spawnSync(
    process.execPath,
    [SCRIPT, cp, ev, keyArg, ...flags.filter((f) => f !== "--key-file")],
    {
      encoding: "utf8",
    },
  );
  return { status: r.status, report: r.stdout ? JSON.parse(r.stdout) : null, stderr: r.stderr };
}

describe("verify-checkpoint.mjs", () => {
  it("imports nothing but node built-ins", () => {
    const src = readFileSync(SCRIPT, "utf8");
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.every((m) => m!.startsWith("node:"))).toBe(true);
    expect(src).not.toMatch(/@ozdna|require\(/);
  });

  it("accepts a valid checkpoint + events with a raw public key, a key file, or a key record", async () => {
    const f = await fixture();
    const cp = { checkpoint: f.checkpoint, signature: f.signature };
    expect(run({ checkpoint: cp, events: f.events, key: f.publicKey }).status).toBe(0);
    expect(run({ checkpoint: cp, events: f.events, key: f.publicKey }, "--key-file").status).toBe(
      0,
    );
    const viaRecord = run({ checkpoint: cp, events: { events: f.events }, key: { key: f.record } });
    expect(viaRecord.status).toBe(0);
    expect(viaRecord.report.valid).toBe(true);
    expect(viaRecord.report.checks.signature).toContain("active");
  });

  it("rejects a tampered event", async () => {
    const f = await fixture();
    const events = clone(f.events) as StoredEvent[];
    (events[3]!.payload as Record<string, unknown>).state = "RETRACTED";
    const r = run({
      checkpoint: { checkpoint: f.checkpoint, signature: f.signature },
      events,
      key: f.publicKey,
    });
    expect(r.status).toBe(1);
    expect(r.report.error.code).toBe("CHAIN_INVALID");
  });

  it("rejects a consistently re-hashed forged history (head mismatch)", async () => {
    const f = await fixture();
    const drafts = fixedDrafts();
    (drafts[3]!.payload as Record<string, unknown>).state = "RETRACTED";
    const forged = await buildChain(drafts);
    const r = run({
      checkpoint: { checkpoint: f.checkpoint, signature: f.signature },
      events: forged,
      key: f.publicKey,
    });
    expect(r.report.error.code).toBe("CHECKPOINT_HEAD_MISMATCH");
  });

  it("rejects a tampered checkpoint, a bad signature and the wrong key", async () => {
    const f = await fixture();
    const editedBody = {
      ...f.checkpoint,
      body: { ...f.checkpoint.body, issued_at: "2030-01-01T00:00:00.000Z" },
    };
    expect(
      run({
        checkpoint: { checkpoint: editedBody, signature: f.signature },
        events: f.events,
        key: f.publicKey,
      }).report.error.code,
    ).toBe("CHECKPOINT_INVALID");
    const flipped = {
      ...f.signature,
      sig: `${f.signature.sig[0] === "A" ? "B" : "A"}${f.signature.sig.slice(1)}`,
    };
    expect(
      run({
        checkpoint: { checkpoint: f.checkpoint, signature: flipped },
        events: f.events,
        key: f.publicKey,
      }).report.error.code,
    ).toBe("SIGNATURE_INVALID");
    const other = await fixture();
    expect(
      run({
        checkpoint: { checkpoint: f.checkpoint, signature: f.signature },
        events: f.events,
        key: other.publicKey,
      }).report.error.code,
    ).toBe("KEY_MISMATCH");
  });

  it("honours key status from a key record: revoked fails, retired-after-issue passes", async () => {
    const f = await fixture();
    const cp = { checkpoint: f.checkpoint, signature: f.signature };
    const revoked = { ...f.record, status: "revoked", revoked_at: "2027-01-01T00:00:00.000Z" };
    expect(run({ checkpoint: cp, events: f.events, key: { key: revoked } }).report.error.code).toBe(
      "KEY_REVOKED",
    );
    const retired = { ...f.record, status: "retired", valid_to: "2026-12-01T00:00:00.000Z" };
    expect(run({ checkpoint: cp, events: f.events, key: { key: retired } }).status).toBe(0);
  });

  it("fails on unattested events unless --allow-unattested", async () => {
    const f = await fixture();
    const more = [
      ...f.events,
      await appendEvent(
        f.events.at(-1)!,
        draft(
          "ai.use_declared",
          { tool: "T", purpose: "code" },
          { recorded_at: "2026-10-07T12:30:00.000Z" },
        ),
      ),
    ];
    const cp = { checkpoint: f.checkpoint, signature: f.signature };
    expect(run({ checkpoint: cp, events: more, key: f.publicKey }).report.error.code).toBe(
      "UNATTESTED_EVENTS",
    );
    expect(
      run({ checkpoint: cp, events: more, key: f.publicKey }, "--allow-unattested").status,
    ).toBe(0);
  });

  it("rejects truncation, non-canonical values and bad input", async () => {
    const f = await fixture();
    const cp = { checkpoint: f.checkpoint, signature: f.signature };
    expect(
      run({ checkpoint: cp, events: f.events.slice(0, 3), key: f.publicKey }).report.error.code,
    ).toBe("CHECKPOINT_BEYOND_CHAIN");
    const floaty = clone(f.events) as StoredEvent[];
    (floaty[3]!.payload as Record<string, unknown>).confidence_bp = 95.5;
    floaty[3]!.event_hash = await computeEventHash(f.events[3]!); // keep hash; value is still invalid
    expect(run({ checkpoint: cp, events: floaty, key: f.publicKey }).report.error.code).toBe(
      "NOT_CANONICAL",
    );
    expect(run({ checkpoint: { nope: 1 }, events: f.events, key: f.publicKey }).status).toBe(2);
  });
});
