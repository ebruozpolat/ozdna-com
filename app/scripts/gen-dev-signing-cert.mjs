#!/usr/bin/env node
/**
 * Generate a local ECDSA P-256 key + self-signed X.509 cert (PEM) for C2PA/dev signing.
 * Writes to app/certs/dev/ (gitignored *.pem / *.key). See certs/dev/README.md.
 *
 * Usage (from app/): npm run certs:dev
 */
import {
  createSign,
  generateKeyPairSync,
  randomBytes,
  X509Certificate,
} from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "certs", "dev");

mkdirSync(outDir, { recursive: true });

const keyPemPath = join(outDir, "signer.key.pem");
const certPemPath = join(outDir, "signer.cert.pem");
const pubPemPath = join(outDir, "signer.pub.pem");

if (existsSync(keyPemPath) || existsSync(certPemPath)) {
  console.error(
    "certs/dev already has signer.key.pem or signer.cert.pem — delete them first to regenerate.",
  );
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
const certPem = buildSelfSignedPem(privateKey, publicKey, "ozDNA Dev Signer", 365);

writeFileSync(keyPemPath, privateKeyPem, { mode: 0o600 });
writeFileSync(certPemPath, certPem, { mode: 0o644 });
writeFileSync(pubPemPath, publicKeyPem, { mode: 0o644 });

const parsed = new X509Certificate(certPem);
console.log(`Wrote:
  ${keyPemPath}
  ${certPemPath}
  ${pubPemPath}
Subject: ${parsed.subject}
Valid:   ${parsed.validFrom} → ${parsed.validTo}
Dev-only self-signed P-256 — official Verify will show "unknown source" (hard rule 5).`);

/** @param {import('node:crypto').KeyObject} priv */
/** @param {import('node:crypto').KeyObject} pub */
function buildSelfSignedPem(priv, pub, cn, days) {
  const now = new Date();
  const notAfter = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const serial = Buffer.concat([Buffer.from([0x01]), randomBytes(7)]);
  const spki = pub.export({ type: "spki", format: "der" });

  const tbs = encodeTbsCertificate({
    serial,
    spki,
    notBefore: now,
    notAfter,
    cn,
  });

  const signer = createSign("SHA256");
  signer.update(tbs);
  signer.end();
  const p1363 = signer.sign(priv);
  const sigDer = p1363ToDer(p1363);

  const certDer = seq(
    tbs,
    seq(oid("1.2.840.10045.4.3.2")), // ecdsa-with-SHA256
    bitString(sigDer),
  );

  // Round-trip through Node's parser to catch encoding bugs early.
  void new X509Certificate(certDer);
  return derToPem(certDer, "CERTIFICATE");
}

function derToPem(der, label) {
  const b64 = der.toString("base64");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`;
}

function seq(...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x30]), lenBytes(body.length), body]);
}

function setOf(...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x31]), lenBytes(body.length), body]);
}

function ctx(tag, ...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0xa0 | tag]), lenBytes(body.length), body]);
}

function intBuf(buf) {
  let b = buf;
  while (b.length > 1 && b[0] === 0x00 && !(b[1] & 0x80)) b = b.subarray(1);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
  return Buffer.concat([Buffer.from([0x02]), lenBytes(b.length), b]);
}

function oid(dotted) {
  const parts = dotted.split(".").map(Number);
  const body = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const stack = [v & 0x7f];
    v >>= 7;
    while (v > 0) {
      stack.push(0x80 | (v & 0x7f));
      v >>= 7;
    }
    for (let j = stack.length - 1; j >= 0; j--) body.push(stack[j]);
  }
  const b = Buffer.from(body);
  return Buffer.concat([Buffer.from([0x06]), lenBytes(b.length), b]);
}

function utf8Str(s) {
  const b = Buffer.from(s, "utf8");
  return Buffer.concat([Buffer.from([0x0c]), lenBytes(b.length), b]);
}

function bitString(payload) {
  const body = Buffer.concat([Buffer.from([0x00]), payload]);
  return Buffer.concat([Buffer.from([0x03]), lenBytes(body.length), body]);
}

function utcTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const yy = pad(d.getUTCFullYear() % 100);
  const s = `${yy}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const b = Buffer.from(s, "ascii");
  return Buffer.concat([Buffer.from([0x17]), lenBytes(b.length), b]);
}

function lenBytes(n) {
  if (n < 0x80) return Buffer.from([n]);
  if (n < 0x100) return Buffer.from([0x81, n]);
  if (n < 0x10000) return Buffer.from([0x82, (n >> 8) & 0xff, n & 0xff]);
  throw new Error("length too large");
}

function encodeTbsCertificate({ serial, spki, notBefore, notAfter, cn }) {
  const version = ctx(0, intBuf(Buffer.from([0x02]))); // v3
  const serialNumber = intBuf(serial);
  const signature = seq(oid("1.2.840.10045.4.3.2"));
  const rdn = seq(setOf(seq(oid("2.5.4.3"), utf8Str(cn))));
  const validity = seq(utcTime(notBefore), utcTime(notAfter));
  return seq(version, serialNumber, signature, rdn, validity, rdn, Buffer.from(spki));
}

function p1363ToDer(p1363) {
  if (p1363[0] === 0x30) return p1363; // already DER
  if (p1363.length !== 64) {
    throw new Error(`unexpected ECDSA sig length ${p1363.length}`);
  }
  return seq(intBuf(p1363.subarray(0, 32)), intBuf(p1363.subarray(32, 64)));
}
