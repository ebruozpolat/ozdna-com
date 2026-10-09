// Writes test/fixtures/chain-v1.json — the frozen provenance-event-v1 test vectors.
// Run ONLY when deliberately introducing a new hash/schema version (see ADR-001):
//   npx tsx packages/provenance-core/scripts/gen-vectors.mts
// For v1 the committed fixture is authoritative; vectors.test.ts fails if code drifts.

import { writeFileSync } from "node:fs";
import { buildCheckpoint } from "../src/checkpoint.js";
import { eventPreimage } from "../src/hash.js";
import { buildChain, fixedDrafts } from "../test/helpers.js";

const events = await buildChain(fixedDrafts());
const checkpoint = await buildCheckpoint(events, "2026-10-07T12:00:00.000Z");
const out = {
  description:
    "ozdna.provenance.event/v1 + checkpoint/v1 test vectors. Normative: app/docs/schemas/provenance-event-v1.md.",
  genesis_preimage: new TextDecoder().decode(eventPreimage(events[0]!)),
  events,
  checkpoint,
};
const path = new URL("../test/fixtures/chain-v1.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${path.pathname}: ${events.length} events, head ${checkpoint.body.head_hash}`);
