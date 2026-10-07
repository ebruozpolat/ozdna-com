import type { EventDraft, StoredEvent } from "@ozdna/provenance-schema";
import { appendEvent } from "../src/chain.js";

export const H = (c: string) => c.repeat(64);
export const PRJ = "prj_0000000001";
export const ACTOR = {
  kind: "person",
  id: "user-17",
  asserted_by: "svc_academicplatform",
} as const;

let n = 0;
function ts(i: number): string {
  return new Date(Date.UTC(2026, 9, 7, 10, 0, i)).toISOString();
}

export function draft(
  type: string,
  payload: Record<string, unknown>,
  overrides: Partial<EventDraft> & Record<string, unknown> = {},
): EventDraft {
  n++;
  return {
    event_id: `evt_${String(n).padStart(10, "0")}`,
    project_id: PRJ,
    type,
    type_version: 1,
    occurred_at: ts(n % 50),
    recorded_at: ts(n % 50),
    actor: { ...ACTOR },
    artifact_id: type === "project.created" ? null : "art_0000000001",
    payload,
    ...overrides,
  } as EventDraft;
}

/** Deterministic drafts for a small realistic chain (ids/timestamps fixed). */
export function fixedDrafts(projectId = PRJ): EventDraft[] {
  const base = (
    i: number,
    type: string,
    payload: Record<string, unknown>,
    artifact: string | null,
  ) =>
    ({
      event_id: `evt_${projectId.slice(4)}${String(i).padStart(4, "0")}`,
      project_id: projectId,
      type,
      type_version: 1,
      occurred_at: ts(i),
      recorded_at: ts(i + 1),
      actor: { ...ACTOR },
      artifact_id: artifact,
      payload,
    }) as EventDraft;
  return [
    base(0, "project.created", { external_ref: "acad-proj-42" }, null),
    base(
      1,
      "artifact.registered",
      {
        kind: "manuscript",
        content_sha256: H("a"),
        byte_length: 1234,
        media_type: "application/pdf",
        label: "Draft v1",
      },
      "art_0000000001",
    ),
    base(
      2,
      "source.cited",
      {
        citation_id: "cit_0000000001",
        identifier: { scheme: "doi", value: "10.1000/xyz123" },
        locator: null,
      },
      "art_0000000001",
    ),
    base(
      3,
      "source.verification_recorded",
      {
        citation_id: "cit_0000000001",
        state: "VERIFIED",
        confidence_bp: 9500,
        components: { title_match: 10000, author_match: 9000 },
        provider: "crossref",
        provider_response_sha256: H("c"),
        candidates: [],
      },
      "art_0000000001",
    ),
    base(4, "ai.use_declared", { tool: "ExampleLLM", purpose: "editing" }, null),
  ];
}

export async function buildChain(drafts: EventDraft[]): Promise<StoredEvent[]> {
  const out: StoredEvent[] = [];
  for (const d of drafts) out.push(await appendEvent(out.at(-1) ?? null, d));
  return out;
}

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}
