# Contributing to ozDNA

Thank you for your interest in contributing to ozDNA. This document explains how to propose changes, report issues, and align with project conventions.

---

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Project areas](#project-areas)
- [Pull request process](#pull-request-process)
- [Coding guidelines](#coding-guidelines)
- [Commit messages](#commit-messages)
- [License](#license)

---

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By participating, you agree to uphold a respectful, inclusive environment.

---

## Ways to contribute

| Type | Where |
|------|-------|
| Bug reports | GitHub Issues — include reproduction steps and environment |
| Feature requests | GitHub Issues — describe the problem and proposed solution |
| Documentation | Pull requests welcome for `docs/`, `knowledge/`, and markdown in repo root |
| Platform code | Pull requests to `platform/` — see setup below |
| Marketing site | Pull requests for HTML/CSS in repo root — keep changes focused |

**Before large changes:** open an issue or discussion to confirm direction, especially for API surface changes, new dependencies, or architectural shifts.

---

## Development setup

### Platform (TypeScript monorepo)

```bash
cd platform
npm install
npm run db:push
npm run db:seed
npm run dev          # API on http://localhost:8787
```

Useful commands:

```bash
npm run build        # compile @ozdna/api
npm run typecheck    # TypeScript check
npm run rag:ingest   # re-ingest RAG corpus
```

**Requirements:** Node.js ≥ 20, npm ≥ 10.

Optional: set `OPENAI_API_KEY` for live inference during development.

### Marketing site

Static HTML at the repository root. Preview locally:

```bash
npx serve .
```

Do not commit `.netlify/` or local deploy artifacts.

---

## Project areas

| Path | Guidelines |
|------|------------|
| `platform/packages/*` | Small, focused packages. Prefer extending existing modules over new abstractions. Match existing TypeScript style. |
| `platform/apps/api` | HTTP handlers stay thin; business logic lives in packages. Update `openapi.json` when routes change. |
| `knowledge/` | Factual, agent-readable markdown. No marketing fluff. Cross-link related docs. |
| Root HTML/CSS | Match existing design tokens in `styles.css`. Test responsive layout. |
| `scripts/` | Shell scripts should be idempotent and fail clearly. |

---

## Pull request process

1. **Fork** the repository and create a feature branch from `main`.
2. **Make focused changes** — one logical change per PR when possible.
3. **Test locally:**
   - Platform: `npm run typecheck` and manual API smoke test
   - Site: verify affected pages in a browser
4. **Update docs** if behavior, API, or setup steps change.
5. **Open a pull request** with:
   - Clear title and description
   - Link to related issue(s)
   - Notes on testing performed
6. **Review** — maintainers may request changes. We aim to respond within a few business days.

We do not merge PRs that:

- Introduce secrets, API keys, or credentials
- Disable security controls without documented justification
- Fabricate production metrics or benchmark data
- Violate the [Code of Conduct](./CODE_OF_CONDUCT.md)

---

## Coding guidelines

### TypeScript (platform)

- Use strict typing; avoid `any` unless unavoidable and documented
- Prefer explicit exports from package `index.ts` entry points
- Keep functions small and named for intent
- Add comments only for non-obvious business logic

### HTML/CSS (marketing site)

- Semantic HTML and accessible labels (`aria-*` where needed)
- Reuse CSS variables from `styles.css` (`--txt`, `--accent`, etc.)
- No inline styles except where already established in the codebase

### General

- Minimize scope — solve the stated problem without unrelated refactors
- Follow existing naming and file layout conventions
- Do not add heavy dependencies without discussion

---

## Commit messages

Use clear, imperative subject lines:

```
Add cache-hit metric row to benchmarks page
Fix rate-limit header on gateway middleware
Update OpenAPI spec for /v1/metrics/cost
```

Optional body for context. Reference issue numbers when applicable: `Fixes #42`.

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](./LICENSE), unless otherwise noted.

---

## Questions

- **General:** hello@ozdna.com
- **Security:** security@ozdna.com (see [SECURITY.md](./SECURITY.md) — do not open public issues for vulnerabilities)
