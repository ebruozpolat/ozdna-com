/** OpenAPI 3.1 — routes currently implemented in apps/api. */
export const openapiYaml = `openapi: 3.1.0
info:
  title: ozDNA API
  version: 0.0.0
  description: |
    Content provenance API (images only in v1). Blockchain is invisible plumbing.
    Never claims official C2PA trust list status until Conformance Program Level 1.
servers:
  - url: https://api.ozdna.com
    description: Production (not yet deployed — needs Cloudflare account)
  - url: http://127.0.0.1:8787
    description: Local wrangler
paths:
  /health:
    get:
      summary: Liveness
      responses:
        "200": { description: OK }
  /v1/openapi.yaml:
    get:
      summary: This document
      responses:
        "200": { description: YAML }
  /v1/waitlist:
    post:
      summary: Join segmented waitlist
      responses:
        "201": { description: Registered }
        "200": { description: Already registered }
  /v1/verify:
    get:
      summary: Registry lookup by content hash
      parameters:
        - name: hash
          in: query
          required: true
          schema: { type: string, pattern: '^[0-9a-fA-F]{64}$' }
      responses:
        "200": { description: Verdict + record or NO_RECORD }
  /v1/registrations:
    post:
      summary: Register client-side hashes (+ optional PDQ)
      responses:
        "201": { description: Created }
        "200": { description: Deduplicated }
  /v1/sign-digest:
    post:
      summary: ECDSA P-256 signature over a digest (requires SIGNING_KEY_JWK)
      responses:
        "200": { description: signature_b64 }
        "503": { description: Signing not configured }
  /v1/records/{id}:
    get:
      summary: Public record
      responses:
        "200": { description: Record }
        "404": { description: Missing }
  /v1/anchors/{batchId}/proof/{recordId}:
    get:
      summary: Anchor batch + leaf index (sibling proof array when persisted)
      responses:
        "200": { description: Proof envelope }
  /v1/usage:
    get:
      summary: Usage/quota (empty until API-key auth)
      responses:
        "200": { description: Usage }
  /v1/webhook-endpoints:
    get:
      summary: List webhook endpoints
      responses:
        "200": { description: endpoints array }
    post:
      summary: Create webhook endpoint
      responses:
        "501": { description: Auth not wired }
`;
