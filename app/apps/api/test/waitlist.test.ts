import { describe, expect, it } from "vitest";
import { ApiError } from "../src/errors.js";
import { handleWaitlist } from "../src/routes/waitlist.js";
import { fixedDeps, FakeRepo } from "./fakes.js";

const valid = { email: "Ebru@Example.com", segment: "ai_company", consent: true };

describe("POST /v1/waitlist", () => {
  it("accepts a valid signup and normalizes the email", async () => {
    const repo = new FakeRepo();
    const res = await handleWaitlist(valid, repo, fixedDeps);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: "ok", segment: "ai_company", deduplicated: false });
    expect(repo.waitlistEmails.has("ebru@example.com")).toBe(true);
  });

  it("is idempotent on email (case-insensitive) → 200 deduplicated", async () => {
    const repo = new FakeRepo();
    await handleWaitlist(valid, repo, fixedDeps);
    const res = await handleWaitlist({ ...valid, email: "EBRU@example.com" }, repo, fixedDeps);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", segment: "ai_company", deduplicated: true });
    expect(repo.waitlistEmails.size).toBe(1);
  });

  it("rejects a missing consent with 400 missing_field", async () => {
    const repo = new FakeRepo();
    await expect(handleWaitlist({ email: "a@b.com", segment: "other" }, repo, fixedDeps)).rejects.toMatchObject({
      status: 400,
      code: "missing_field",
    });
  });

  it("rejects a bad email and an unknown segment", async () => {
    const repo = new FakeRepo();
    await expect(handleWaitlist({ email: "not-an-email", segment: "other", consent: true }, repo, fixedDeps)).rejects.toBeInstanceOf(ApiError);
    await expect(handleWaitlist({ email: "a@b.com", segment: "vip", consent: true }, repo, fixedDeps)).rejects.toBeInstanceOf(ApiError);
  });
});
