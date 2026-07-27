/** Minimal OpenAPI 3.1 skeleton — expand as routes land (plan/04 §4). */
export const openapiYaml = `openapi: 3.1.0
info:
  title: ozDNA API
  version: 0.0.0
  description: |
    Content provenance API (images only in v1). Blockchain is invisible plumbing.
    Never claims official C2PA trust list status until Conformance Program Level 1.
servers:
  - url: https://api.ozdna.com
    description: Production (not yet deployed)
  - url: http://127.0.0.1:8787
    description: Local wrangler
paths:
  /health:
    get:
      summary: Liveness
      responses:
        "200":
          description: OK
  /v1/openapi.yaml:
    get:
      summary: This document
      responses:
        "200":
          description: YAML
  /v1/waitlist:
    post:
      summary: Join segmented waitlist (API path; marketing forms also use Netlify Forms)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, segment, consent]
              properties:
                email: { type: string, format: email }
                segment:
                  type: string
                  enum: [ai_company, seller_creator, fact_checker, other]
                locale: { type: string, enum: [en, tr] }
                source: { type: string }
                consent: { type: boolean, const: true }
      responses:
        "201": { description: Registered }
        "200": { description: Already registered }
        "400": { description: Validation error }
  /v1/verify:
    get:
      summary: Registry lookup by content hash
      parameters:
        - name: hash
          in: query
          required: true
          schema: { type: string, pattern: '^[0-9a-fA-F]{64}$' }
      responses:
        "200":
          description: NO_RECORD or REGISTRY_HIT
        "400": { description: Invalid hash }
`;
