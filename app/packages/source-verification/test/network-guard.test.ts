import "./no-network.js";
import { describe, expect, it } from "vitest";
import { verifyReference } from "../src/verify.js";
import { takeBlockedAttempts } from "./no-network.js";

describe("network guard", () => {
  it("an unmocked fetch is blocked and recorded (so the afterEach hook would fail the test)", async () => {
    await expect(globalThis.fetch("https://api.crossref.org/works/10.5555/x")).rejects.toThrow(
      /unmocked network call/,
    );
    expect(takeBlockedAttempts()).toEqual(["https://api.crossref.org/works/10.5555/x"]);
  });

  it("adapters given the real global fetch fail closed — and the guard catches the attempt", async () => {
    const res = await verifyReference(
      { identifier: { scheme: "doi", value: "10.5555/ozdna.normal.2024" } },
      { fetch: globalThis.fetch, contactEmail: "provenance-tests@ozdna.example" },
    );
    expect(res).toMatchObject({ state: "UNVERIFIED", reason: "RA_NETWORK" });
    expect(takeBlockedAttempts()).toEqual(["https://doi.org/doiRA/10.5555/ozdna.normal.2024"]);
  });
});
