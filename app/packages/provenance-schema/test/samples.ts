// Minimal valid payloads for every registered type — used by schema and registry tests.

export const H = (c: string) => c.repeat(64);

export const SAMPLE_PAYLOADS: Record<
  string,
  { artifact: boolean; payload: Record<string, unknown> }
> = {
  "project.created@1": { artifact: false, payload: { external_ref: "acad-proj-42" } },
  "artifact.registered@1": {
    artifact: true,
    payload: {
      kind: "manuscript",
      content_sha256: H("a"),
      byte_length: 1234,
      media_type: "application/pdf",
      label: "Draft v1",
    },
  },
  "artifact.version_added@1": {
    artifact: true,
    payload: {
      content_sha256: H("b"),
      byte_length: 2048,
      media_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      supersedes_sha256: H("a"),
    },
  },
  "source.cited@1": {
    artifact: true,
    payload: {
      citation_id: "cit_0000000001",
      identifier: { scheme: "doi", value: "10.1000/xyz123" },
      locator: "p. 12",
    },
  },
  "source.verification_recorded@1": {
    artifact: true,
    payload: {
      citation_id: "cit_0000000001",
      state: "VERIFIED",
      confidence_bp: 9500,
      components: { title_match: 10000, author_match: 9000 },
      provider: "crossref",
      provider_response_sha256: H("c"),
      candidates: [],
    },
  },
  "source.imported@1": {
    artifact: false,
    payload: {
      source_id: "src_0000000001",
      citation_id: "cit_0000000001",
      identifier: { scheme: "doi", value: "10.5555/example" },
      input_kind: "identifier",
      input_sha256: H("d"),
    },
  },
  "source.status_changed@1": {
    artifact: false,
    payload: {
      source_id: "src_0000000001",
      previous_state: "VERIFIED",
      state: "RETRACTED",
      result_id: "svr_0000000001",
      snapshot_sha256: H("e"),
      trigger: "refresh",
    },
  },
  "source.rejected@1": {
    artifact: false,
    payload: {
      citation_id: "cit_0000000001",
      reason: "identifier_ambiguous",
      input_sha256: H("d"),
      candidates: [
        { scheme: "doi", value: "10.5555/abc" },
        { scheme: "doi", value: "10.5555/abc)" },
      ],
    },
  },
  "source.verification_failed@1": {
    artifact: false,
    payload: {
      source_id: "src_0000000001",
      reason: "timeout",
      verifier_version: "0.4.0",
      attempted_providers: ["doi_ra"],
    },
  },
  "claim.recorded@1": {
    artifact: true,
    payload: {
      claim_id: "clm_0000000001",
      claim_commitment: H("d"),
      commitment_scheme: "hmac-sha256/v1",
    },
  },
  "claim.source_linked@1": {
    artifact: true,
    payload: { claim_id: "clm_0000000001", citation_id: "cit_0000000001", relation: "supports" },
  },
  "ai.use_declared@1": { artifact: false, payload: { tool: "ExampleLLM", purpose: "editing" } },
  "ai.use_observed@1": {
    artifact: true,
    payload: {
      tool: "ExampleLLM",
      operation: "citation_suggested",
      prompt_sha256: H("e"),
      output_sha256: null,
      citation_id: "cit_0000000001",
    },
  },
  "evidence_pack.generated@1": {
    artifact: false,
    payload: {
      pack_schema: "ozdna.provenance.pack/v1",
      pack_sha256: H("f"),
      checkpoint_seq: 3,
      checkpoint_digest: H("0"),
    },
  },
};

export function sampleEvent(typeAtVersion: string, overrides: Record<string, unknown> = {}) {
  const sample = SAMPLE_PAYLOADS[typeAtVersion];
  if (!sample) throw new Error(`no sample for ${typeAtVersion}`);
  const [type, version] = typeAtVersion.split("@") as [string, string];
  return {
    schema: "ozdna.provenance.event/v1",
    event_id: "evt_0000000001",
    project_id: "prj_0000000001",
    seq: type === "project.created" ? 0 : 1,
    prev_hash: H("0"),
    type,
    type_version: Number(version),
    occurred_at: "2026-10-07T10:00:00.000Z",
    recorded_at: "2026-10-07T10:00:01.000Z",
    actor: { kind: "person", id: "user-17", asserted_by: "svc_academicplatform" },
    artifact_id: sample.artifact ? "art_0000000001" : null,
    payload: structuredClone(sample.payload),
    ...overrides,
  };
}

export function stored(ev: Record<string, unknown>) {
  return { ...ev, event_hash: H("9") };
}
