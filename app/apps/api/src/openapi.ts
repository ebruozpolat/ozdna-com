/** OpenAPI 3.1 — routes currently implemented in apps/api. */
export const openapiYaml = `openapi: 3.1.0
info:
  title: ozDNA API
  version: 0.1.0
  description: |
    Content provenance API (images only in v1). Blockchain is invisible plumbing.
    Never claims official C2PA trust list status until Conformance Program Level 1.
    POST /v1/marks is registry-only until the September embed spike.
servers:
  - url: https://api.ozdna.com
    description: Production
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
      summary: Exact (hash=) or perceptual (phash= + optional pdq=) registry lookup
      parameters:
        - name: hash
          in: query
          schema: { type: string, pattern: '^[0-9a-fA-F]{64}$' }
        - name: phash
          in: query
          schema: { type: string, pattern: '^[0-9a-fA-F]{16}$' }
        - name: pdq
          in: query
          schema: { type: string, pattern: '^[0-9a-fA-F]{64}$' }
        - name: deep
          in: query
          description: "1 = stage-3 r=2 probes (complete for d≤10); default r=1"
          schema: { type: string, enum: ["0", "1"] }
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
  /v1/bootstrap/api-key:
    post:
      summary: One-shot user + live API key (requires BOOTSTRAP_TOKEN)
      responses:
        "201": { description: Created; api_key shown once }
        "401": { description: Bad bootstrap token }
        "503": { description: Bootstrap disabled }
  /v1/marks:
    post:
      summary: Registry-only AI mark (API key). Accepts optional pdq256. No C2PA embed yet.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { description: Registered }
        "200": { description: Deduplicated }
        "401": { description: Missing/invalid API key }
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
      summary: Current-month usage + quota (API key)
      security: [{ bearerAuth: [] }]
      responses:
        "200": { description: Usage }
        "401": { description: Missing/invalid API key }
  /v1/webhook-endpoints:
    get:
      summary: List webhook endpoints
      security: [{ bearerAuth: [] }]
      responses:
        "200": { description: endpoints array }
    post:
      summary: Create webhook endpoint (secret shown once)
      security: [{ bearerAuth: [] }]
      responses:
        "201": { description: Created }
  /v1/webhook-endpoints/{id}:
    delete:
      summary: Revoke webhook endpoint
      security: [{ bearerAuth: [] }]
      responses:
        "200": { description: Revoked }
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: ozdna_live_… or ozdna_test_…
`;
