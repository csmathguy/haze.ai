# Taxes

Local-first tax workflow application for ingesting private tax documents, extracting structured data, reviewing gaps in a UI, and producing filing-ready outputs without sending sensitive data to external services.

## Current Focus

This repository now has an initial working scaffold. The current deliverables are:
- repository guidance in `AGENTS.md`
- stack and workflow documentation in `docs/`
- project-local agent skills in `skills/`
- a Fastify API scaffold in `apps/api`
- a Vite + React + MUI web scaffold in `apps/web`
- shared tax-domain contracts in `packages/shared`
- SQLite + Prisma persistence for structured metadata, review state, and lot tracking

## Planned Repository Shape

```text
apps/
  api/        Node + TypeScript backend
  web/        React + TypeScript frontend
packages/
  shared/     shared domain types, schemas, and utilities
docs/         project standards, architecture, and research notes
skills/       project-local agent skills
tools/arch/   architecture rule configuration
```

## Tooling Baseline

- Node.js `24.14.0+`
- npm `11.6.4+`
- `npm run typecheck`
- `npm run lint`
- `npm run stylelint`
- `npm test`
- `npm run test:coverage`
- `npm run prisma:check`
- `npm run prisma:migrate:deploy`
- `npm run quality`
- `npm run quality:changed -- <files...>`
- `node tools/runtime/run-npm.cjs run <script>` when the shell default Node version does not match `.nvmrc`
- git hooks via `simple-git-hooks`:
  - `pre-commit`: changed-file guardrails
  - `pre-push`: full audited guardrails

## Repository Hygiene

- `.editorconfig` standardizes line endings and whitespace.
- `.gitattributes` normalizes text files to LF and marks common binaries.
- `.github/workflows/ci.yml` runs the `quality` job on pull requests and `main`.
- `.github/dependabot.yml` tracks npm and GitHub Action updates.
- `.github/ISSUE_TEMPLATE/` and `.github/pull_request_template.md` standardize intake and review.
- `.github/CODEOWNERS`, `CONTRIBUTING.md`, and `SECURITY.md` define ownership and contribution expectations.

## Documentation Map

- `docs/README.md`
- `docs/project-vision.md`
- `docs/architecture.md`
- `docs/frontend-react-typescript.md`
- `docs/frontend-styling-standards.md`
- `docs/backend-node-typescript.md`
- `docs/database-prisma-sqlite.md`
- `docs/tax-domain-model.md`
- `docs/testing-and-quality.md`
- `docs/architecture-enforcement.md`
- `docs/security-and-privacy.md`
- `docs/github-repository.md`
- `docs/agent-guidelines.md`
- `docs/agent-observability.md`
- `docs/research-sources.md`
