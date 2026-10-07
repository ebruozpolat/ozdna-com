// Repository interfaces. Every read and write of tenant data goes through these, and every
// method takes the tenant id from the authenticated service key — there is no unscoped
// query. Writes are returned as opaque statements so a caller can commit several stores'
// writes atomically (one D1 batch = one transaction).

import type { StoredEvent } from "@ozdna/provenance-schema";

/** An opaque, not-yet-executed write. Commit with UnitOfWork.commit. */
export type Write = { readonly __write: unique symbol } & D1PreparedStatement;

export interface UnitOfWork {
  /** Execute writes in one transaction; all or nothing. */
  commit(writes: readonly Write[]): Promise<void>;
}

export interface ProjectRow {
  readonly id: string;
  readonly external_ref: string;
  readonly created_at: string;
}

export interface ProjectStore {
  insert(tenantId: string, row: { id: string; externalRef: string }): Write;
  get(tenantId: string, projectId: string): Promise<ProjectRow | null>;
  list(tenantId: string, opts: { limit: number; afterId?: string }): Promise<ProjectRow[]>;
}

export interface EventRow {
  readonly seq: number;
  readonly canonical: string;
}

export interface EventStore {
  head(tenantId: string, projectId: string): Promise<EventRow | null>;
  getBySeq(tenantId: string, projectId: string, seq: number): Promise<EventRow | null>;
  list(
    tenantId: string,
    projectId: string,
    opts: { afterSeq: number; limit: number },
  ): Promise<EventRow[]>;
  insert(tenantId: string, event: StoredEvent, canonical: string): Write;
}

export interface ArtifactRow {
  readonly id: string;
  readonly kind: string;
  readonly content_sha256: string;
  readonly byte_length: number;
  readonly media_type: string;
  readonly registered_seq: number;
}

export interface ArtifactStore {
  insert(tenantId: string, projectId: string, row: ArtifactRow): Write;
  get(tenantId: string, projectId: string, artifactId: string): Promise<ArtifactRow | null>;
}

export interface IdempotencyRow {
  readonly request_hash: string;
  readonly seq: number;
}

export interface IdempotencyStore {
  get(tenantId: string, projectId: string, key: string): Promise<IdempotencyRow | null>;
  insert(tenantId: string, projectId: string, key: string, requestHash: string, seq: number): Write;
}

export interface TenantStore {
  /** Admin-only: create a tenant and its first service key (hash only). */
  createWithKey(row: {
    tenantId: string;
    name: string;
    keyId: string;
    serviceId: string;
    keyHash: string;
    keyPrefix: string;
    scopes: readonly string[];
  }): Promise<void>;
}

export interface Stores {
  readonly uow: UnitOfWork;
  readonly tenants: TenantStore;
  readonly projects: ProjectStore;
  readonly events: EventStore;
  readonly artifacts: ArtifactStore;
  readonly idempotency: IdempotencyStore;
}
