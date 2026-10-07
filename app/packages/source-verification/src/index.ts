// @ozdna/source-verification — Phase 4a/4b. Spec and evidence: app/docs/adr/ADR-004.
// engine.ts, identifiers.ts and text.ts are pure; adapters do I/O only through an injected
// fetch and a fixed host allow-list.

export * from "./adapters/context.js";
export * from "./adapters/crossref.js";
export * from "./adapters/datacite.js";
export * from "./adapters/doi-ra.js";
export * from "./engine.js";
export * from "./http.js";
export * from "./identifiers.js";
export * from "./payload.js";
export * from "./text.js";
export * from "./types.js";
export * from "./verify.js";
