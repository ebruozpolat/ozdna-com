// ozdna-provenance-signer — RPC-only Worker. The provenance API reaches it through a service
// binding to the "Signer" entrypoint. Its fetch handler serves nothing.
// No logging: neither inputs nor key material are ever logged.

import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env.js";
import { createSigner, type SignerCore } from "./signer.js";

let cached: { secret: string; core: Promise<SignerCore> } | null = null;

function core(env: Env): Promise<SignerCore> {
  const secret = env.SIGNING_KEY_ED25519_JWK ?? "";
  if (!cached || cached.secret !== secret) {
    cached = { secret, core: createSigner(env.SIGNING_KEY_ED25519_JWK) };
    // a failed import must not be cached forever
    cached.core.catch(() => {
      cached = null;
    });
  }
  return cached.core;
}

export class Signer extends WorkerEntrypoint<Env> {
  async publicKey() {
    return (await core(this.env)).publicKey();
  }

  async signCheckpoint(body: unknown) {
    return (await core(this.env)).signCheckpoint(body);
  }

  async signEvent(event: unknown) {
    return (await core(this.env)).signEvent(event);
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
