#!/usr/bin/env node
// Offline verifier for ozDNA research-provenance checkpoints.
//
// Uses ONLY node:crypto / node:fs — no ozDNA code — so anyone can audit and run it.
// Spec: app/docs/schemas/provenance-event-v1.md (§3 canonical JSON, §4 event hash,
// §6 checkpoint, §8 signatures).
//
// Usage:
//   node verify-checkpoint.mjs <checkpoint.json> <events.json> <public-key> [--allow-unattested]
//
//   checkpoint.json  {"checkpoint": {"body": …, "digest": …}, "signature": {"alg","key_id","sig"}}
//                    (the response of POST …/checkpoints or GET …/checkpoints/latest)
//   events.json      an array of events, or {"events": […]} (GET …/events)
//   public-key       raw Ed25519 public key as base64url, or a file holding it, or a file
//                    holding GET /v1/keys/{key_id} output ({"key": {…}}) — in which case the
//                    key's status and validity window are checked too
//
// Checks the hash chain (structure, links, hashes), the checkpoint digest and head, and the
// Ed25519 signature. It does NOT run the event-type registry's payload validation (that
// needs the schema package); a chain that passes here is cryptographically intact.
//
// Exit 0 = valid, 1 = invalid, 2 = usage/input error. Prints a JSON report.

import { createHash, createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const EVENT_PREFIX = "ozdna.provenance.event/v1\n";
const CHECKPOINT_PREFIX = "ozdna.provenance.checkpoint/v1\n";
const GENESIS = "0".repeat(64);

class Invalid extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ---- canonical JSON (ozdna-cjson/v1): JCS restricted to safe integers and NFC strings ----

function checkString(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = s.charCodeAt(i + 1);
      if (!(n >= 0xdc00 && n <= 0xdfff)) throw new Invalid("NOT_CANONICAL", "lone surrogate");
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      throw new Invalid("NOT_CANONICAL", "lone surrogate");
    }
  }
  if (s.normalize("NFC") !== s) throw new Invalid("NOT_CANONICAL", "string is not NFC");
}

function cjson(v, depth = 0) {
  if (depth > 32) throw new Invalid("NOT_CANONICAL", "too deep");
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw new Invalid("NOT_CANONICAL", "only safe integers allowed");
    return String(v);
  }
  if (typeof v === "string") {
    checkString(v);
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map((x) => cjson(x, depth + 1)).join(",")}]`;
  if (typeof v === "object") {
    const keys = Object.keys(v).sort(); // UTF-16 code-unit order, as JCS requires
    return `{${keys
      .map((k) => {
        if (k === "__proto__") throw new Invalid("NOT_CANONICAL", "__proto__ key");
        checkString(k);
        return `${JSON.stringify(k)}:${cjson(v[k], depth + 1)}`;
      })
      .join(",")}}`;
  }
  throw new Invalid("NOT_CANONICAL", `unsupported value of type ${typeof v}`);
}

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

function b64urlToBuffer(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]+$/.test(s))
    throw new Invalid("BAD_INPUT", "not base64url");
  return Buffer.from(s, "base64url");
}

// ---- inputs ----

function readJson(path) {
  try {
    // JSON.parse keeps "__proto__" as an own key, so cjson() can reject it.
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Invalid("BAD_INPUT", `cannot read JSON from ${path}: ${e.message}`);
  }
}

function loadKey(arg) {
  let text = arg;
  if (existsSync(arg)) text = readFileSync(arg, "utf8").trim();
  if (text.startsWith("{")) {
    const parsed = JSON.parse(text);
    const record = parsed.key ?? parsed;
    return { raw: b64urlToBuffer(record.public_key), record };
  }
  return { raw: b64urlToBuffer(text), record: null };
}

// ---- verification ----

function verifyChain(events) {
  let prev = GENESIS;
  let project = null;
  let lastRecordedAt = "";
  const hashes = [];
  events.forEach((ev, i) => {
    if (ev === null || typeof ev !== "object" || Array.isArray(ev)) {
      throw new Invalid("CHAIN_INVALID", `seq ${i}: not an object`);
    }
    const { event_hash, ...rest } = ev;
    if (ev.schema !== "ozdna.provenance.event/v1")
      throw new Invalid("CHAIN_INVALID", `seq ${i}: unknown schema`);
    if (ev.seq !== i) throw new Invalid("CHAIN_INVALID", `position ${i}: seq is ${ev.seq}`);
    if (i === 0 && ev.type !== "project.created")
      throw new Invalid("CHAIN_INVALID", "seq 0 is not project.created");
    if (i > 0 && ev.type === "project.created")
      throw new Invalid("CHAIN_INVALID", `seq ${i}: repeated genesis`);
    project ??= ev.project_id;
    if (ev.project_id !== project)
      throw new Invalid("CHAIN_INVALID", `seq ${i}: different project`);
    if (ev.prev_hash !== prev)
      throw new Invalid("CHAIN_INVALID", `seq ${i}: prev_hash does not link`);
    if (typeof ev.recorded_at !== "string" || ev.recorded_at < lastRecordedAt) {
      throw new Invalid("CHAIN_INVALID", `seq ${i}: recorded_at goes backwards`);
    }
    const h = sha256(EVENT_PREFIX + cjson(rest));
    if (h !== event_hash)
      throw new Invalid("CHAIN_INVALID", `seq ${i}: event_hash does not match content`);
    prev = h;
    lastRecordedAt = ev.recorded_at;
    hashes.push(h);
  });
  return { project, hashes };
}

function verifyCheckpointFiles(cpFile, eventsFile, keyArg, allowUnattested) {
  const report = { valid: false, checks: {}, error: null };
  try {
    const cpDoc = readJson(cpFile);
    const evDoc = readJson(eventsFile);
    const events = Array.isArray(evDoc) ? evDoc : evDoc.events;
    if (!Array.isArray(events)) throw new Invalid("BAD_INPUT", "events file has no events array");
    const { checkpoint, signature } = cpDoc;
    if (!checkpoint?.body || typeof checkpoint.digest !== "string" || !signature) {
      throw new Invalid(
        "BAD_INPUT",
        "checkpoint file must hold {checkpoint:{body,digest}, signature}",
      );
    }
    const body = checkpoint.body;
    const key = loadKey(keyArg);

    // 1. chain
    const chain = verifyChain(events);
    report.checks.chain = `ok (${events.length} events)`;

    // 2. checkpoint digest and coverage
    if (body.schema !== "ozdna.provenance.checkpoint/v1")
      throw new Invalid("CHECKPOINT_INVALID", "unknown checkpoint schema");
    const preimage = CHECKPOINT_PREFIX + cjson(body);
    if (sha256(preimage) !== checkpoint.digest)
      throw new Invalid("CHECKPOINT_INVALID", "digest does not match body");
    if (body.event_count !== body.head_seq + 1)
      throw new Invalid("CHECKPOINT_INVALID", "event_count != head_seq + 1");
    if (body.project_id !== chain.project)
      throw new Invalid("CHECKPOINT_INVALID", "checkpoint is for another project");
    if (events.length < body.event_count)
      throw new Invalid("CHECKPOINT_BEYOND_CHAIN", "chain is shorter than the checkpoint");
    if (chain.hashes[body.head_seq] !== body.head_hash)
      throw new Invalid("CHECKPOINT_HEAD_MISMATCH", "history differs from the checkpoint");
    if (body.issued_at < events[body.head_seq].recorded_at)
      throw new Invalid("CHECKPOINT_PREDATES_HEAD", "checkpoint predates its head");
    const unattested = events.length - body.event_count;
    if (unattested > 0 && !allowUnattested) {
      throw new Invalid(
        "UNATTESTED_EVENTS",
        `${unattested} event(s) after the checkpoint are not attested`,
      );
    }
    report.checks.checkpoint = `ok (covers ${body.event_count}, unattested ${unattested})`;

    // 3. signature
    if (signature.alg !== "Ed25519")
      throw new Invalid("SIGNATURE_INVALID", "unsupported algorithm");
    if (key.raw.length !== 32)
      throw new Invalid("BAD_INPUT", "Ed25519 public key must be 32 bytes");
    const keyId = `ed25519-${createHash("sha256").update(key.raw).digest("hex").slice(0, 32)}`;
    if (signature.key_id !== keyId)
      throw new Invalid("KEY_MISMATCH", "signature names a different key");
    if (key.record) {
      if (key.record.key_id !== keyId)
        throw new Invalid("KEY_MISMATCH", "key record does not match key bytes");
      if (key.record.status === "revoked" || key.record.revoked_at)
        throw new Invalid("KEY_REVOKED", "key is revoked");
      if (body.issued_at < key.record.valid_from)
        throw new Invalid("KEY_NOT_YET_VALID", "issued before key validity");
      if (key.record.valid_to && body.issued_at > key.record.valid_to)
        throw new Invalid("KEY_EXPIRED", "issued after key retirement");
    }
    const publicKey = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: key.raw.toString("base64url") },
      format: "jwk",
    });
    const sig = b64urlToBuffer(signature.sig);
    if (sig.length !== 64 || !verify(null, Buffer.from(preimage, "utf8"), publicKey, sig)) {
      throw new Invalid("SIGNATURE_INVALID", "Ed25519 signature does not verify");
    }
    report.checks.signature = `ok (${keyId}${key.record ? `, ${key.record.status}` : ", key status not checked"})`;
    report.valid = true;
    return { report, exit: 0 };
  } catch (e) {
    if (!(e instanceof Invalid)) throw e;
    report.error = { code: e.code, message: e.message };
    return { report, exit: e.code === "BAD_INPUT" ? 2 : 1 };
  }
}

const args = process.argv.slice(2);
const allow = args.includes("--allow-unattested");
const positional = args.filter((a) => !a.startsWith("--"));
if (positional.length !== 3) {
  process.stderr.write(
    "usage: verify-checkpoint.mjs <checkpoint.json> <events.json> <public-key> [--allow-unattested]\n",
  );
  process.exit(2);
}
const { report, exit } = verifyCheckpointFiles(positional[0], positional[1], positional[2], allow);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(exit);
