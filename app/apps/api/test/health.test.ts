import { describe, expect, it } from "vitest";
import app from "../src/index.js";

describe("api health", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("http://local/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("ozdna-api");
  });

  it("GET /v1/openapi.yaml is yaml", async () => {
    const res = await app.request("http://local/v1/openapi.yaml");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("openapi: 3.1.0");
    expect(text).toContain("/v1/verify");
  });
});
