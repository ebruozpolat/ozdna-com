# ozDNA IAM — Organizations, Workspaces, RBAC

Identity and access model for the **Admin Dashboard** (Module 10) and **Org/Workspace API** (Module 7).

---

## Hierarchy

```
Organization (billing + legal tenant)
    │
    ├── Users ────────────── org membership + role
    │
    ├── Workspaces ───────── team / env boundary (prod, staging, comply)
    │       │
    │       └── Projects ─── API surface + RAG corpora scope
    │               │
    │               └── API Keys ── Bearer auth (test / live)
    │
    ├── Roles ────────────── named bundles of permissions
    └── Permissions ──────── atomic actions (api_keys:write, …)
```

| Entity | Purpose | v0.1 |
|--------|---------|------|
| **Organization** | Top-level tenant; plan, billing, audit scope | ✅ DB + seed |
| **User** | Human operator (dashboard login) | ✅ DB + seed |
| **Workspace** | Isolation within org (team, region, product line) | ✅ DB + seed |
| **Project** | Resource container; keys and RAG scoped here | ✅ DB + seed |
| **API Keys** | Machine auth; `ozdna_sk_test_` / `ozdna_sk_live_` | ✅ Runtime |
| **Roles** | Owner, Admin, Developer, Viewer (+ custom later) | ✅ DB + seed |
| **Permissions** | Fine-grained allow list | ✅ DB + seed |

**Today:** API requests authenticate via **API key → project → org**. Dashboard session auth (email + org switcher) ships with Admin Dashboard MVP (Q4 2026).

---

## Admin Dashboard navigation

Customer console sidebar (maps 1:1 to REST admin API groups):

| Nav item | Manages | Planned API prefix |
|----------|---------|-------------------|
| **Organizations** | Org profile, plan, billing account | `GET/PATCH /v1/orgs/:id` |
| **Users** | Members, invites, seat count | `GET/POST /v1/orgs/:id/members` |
| **Workspaces** | Create/rename/archive workspaces | `GET/POST /v1/orgs/:id/workspaces` |
| **Projects** | Projects per workspace | `GET/POST /v1/workspaces/:id/projects` |
| **API Keys** | Create, revoke, rotate, scopes | `GET/POST /v1/projects/:id/keys` |
| **Roles** | Custom roles (Enterprise) | `GET/POST /v1/orgs/:id/roles` |
| **Permissions** | Read-only catalog + role matrix | `GET /v1/permissions` |

Operator (internal) console adds: cross-org search, quota override, incident mode.

---

## Default roles

| Role | Typical assignee | Capabilities |
|------|------------------|--------------|
| **owner** | Founder / account owner | Full org control incl. billing, delete org, role assignment |
| **admin** | CTO, platform lead | Workspaces, projects, keys, members; no org deletion |
| **developer** | Engineer | Projects + keys in assigned workspaces; usage read |
| **viewer** | Finance, support | Read-only: usage, cost, audit tail |

Roles bind to **org** (`org_members`) or **workspace** (`workspace_members`) for scoped access.

---

## Permission catalog (v0.1)

| Permission | Description |
|------------|-------------|
| `org:read` | View org settings |
| `org:write` | Update org name, metadata |
| `org:delete` | Delete organization (owner only) |
| `members:read` | List org/workspace members |
| `members:write` | Invite, remove, change roles |
| `workspace:read` | List/view workspaces |
| `workspace:write` | Create, update, archive workspaces |
| `project:read` | List/view projects |
| `project:write` | Create, update projects |
| `api_keys:read` | List keys (prefix only, never secret) |
| `api_keys:write` | Create keys |
| `api_keys:revoke` | Revoke / rotate keys |
| `usage:read` | Usage + cost metrics |
| `billing:read` | Plan, quota, invoices |
| `billing:write` | Change plan (owner/admin) |
| `audit:read` | Query audit log |
| `roles:read` | View roles and permission matrix |
| `roles:write` | Create custom roles (Enterprise) |

---

## API key vs dashboard auth

| Path | Auth | Scope |
|------|------|-------|
| `POST /v1/detect`, metrics, RAG, LLM gateway | Bearer API key | Single project; enforced by gateway |
| Admin CRUD (`/v1/orgs`, workspaces, projects, keys) | Bearer API key | Org scope; RBAC role checks ship with dashboard MVP |

Keys never inherit dashboard permissions — they carry project scope only.

---

## Schema location

Drizzle definitions: `packages/db/src/schema.ts`  
Seed (demo org, workspace, roles): `packages/db/src/seed.ts`

---

## GA checklist (Module 7 + 10)

- [x] Tables: organizations, workspaces, users, projects, api_keys, roles, permissions, memberships
- [x] REST: org / workspace / project CRUD (create + read + org patch)
- [ ] REST: members invite + role assignment
- [x] REST: API key lifecycle (list, create, revoke)
- [ ] Session auth + org switcher in dashboard
- [ ] Permission checks on every admin route (org scope only today)

See [MODULES.md](./MODULES.md) for platform-wide GA criteria.
