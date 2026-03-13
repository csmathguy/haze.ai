# Testing And Quality

## Core Workflow

Use red-green-refactor as the default loop:

1. Write or update a failing test that captures the intended behavior.
2. Implement the smallest change that makes the test pass.
3. Refactor while keeping tests green and improving names, structure, and duplication.

## Required Gates

Before closing a change, run the strongest available checks for the touched scope:

- `npm run quality:changed -- <files...>` while iterating on a focused change
- `npm run prisma:check` when Prisma schema or database code changes
- `npm run prisma:migrate:deploy` when local schema changes need to be applied
- `npm run typecheck`
- `npm run lint`
- `npm run stylelint` for frontend CSS and CSS Modules
- `npm test` or a narrower test command such as `npm run test:arch`

Git hooks also enforce the workflow:

- `pre-commit` runs `npm run quality:changed:staged`
- `pre-push` runs `npm run quality:logged -- pre-push`
- if your shell default Node version does not match `.nvmrc`, use `node tools/runtime/run-npm.cjs run <script>` instead of `nvm use`

That keeps fast feedback on staged files while reserving the full suite for branch publication.

## Definition Of Done

Implementation work is not done just because the code passes locally. For branch-ready changes, definition of done includes:

- the intended behavior or documentation outcome is complete
- the strongest relevant validation has passed
- the worktree is clean because the finished change was committed in atomic commits
- the branch is pushed
- the branch has an open pull request that follows `docs/pull-request-standards.md`

Use this command for the publication step:

```powershell
node tools/runtime/run-npm.cjs run pr:sync -- --summary "<what changed>" --value "<why it matters>" --privacy-confirmed
```

`npm run workflow:end implementation success` now treats a clean worktree and an open PR as completion requirements when the branch has commits ahead of `main`.

## Enforced Budgets

The current repository guardrails enforce these defaults:

- max file length: 400 lines, excluding blank lines and comments
- max function length: 75 lines, excluding blank lines and comments
- max cyclomatic complexity: 10
- max nesting depth: 3
- max parameters per function: 4
- max top-level console usage: `warn` and `error` only

These are intentionally strict enough to push decomposition early without forcing tiny unusable fragments.

## Test Pyramid

- Unit tests: parsing logic, mappers, services, reducers, hooks, pure helpers
- Integration tests: backend routes with adapters stubbed or sandboxed, component flows with realistic data
- End-to-end tests: critical import, review, and export workflows

## Refactor Standards

- Keep behavior-preserving refactors separate from feature changes when practical.
- Do not widen public interfaces without a real consumer need.
- Remove duplication only when the new abstraction is simpler than the repeated code.

## Design Principles In Practice

- SOLID: use interfaces and composition to keep document extraction, mapping, and reporting replaceable
- DRY: share domain schemas and validation rules, not unrelated UI and backend code
- KISS: prefer a direct workflow with clear seams over premature plugin systems
- GoF patterns that fit this project:
  - Strategy for extractor selection
  - Adapter for third-party parsers or converters
  - Factory for report builder or extractor creation
  - Observer only if eventing is needed later, not by default

## Coverage Priorities

- High confidence for tax calculations, normalization, and export formatting
- Moderate confidence for UI rendering and workflow state transitions
- Snapshot tests only for stable presentation primitives, not as the main safety net

## Coverage Threshold Policy

- Use global thresholds rather than per-file thresholds until the application has enough feature depth for per-file enforcement to be meaningful.
- Current baseline:
  - statements: 80%
  - lines: 80%
  - functions: 80%
  - branches: 70%
- Raise thresholds when business logic grows and the current level no longer reflects enterprise-ready confidence.

## Current Test Tooling

- Vitest is the default unit test runner.
- V8 coverage is enabled through `npm run test:coverage`.
- `vitest related --run` is used by the changed-file guardrail script for focused source changes.
- Vitest excludes `.worktrees/`, `node_modules/`, `artifacts/`, and other generated folders so parallel worktrees and third-party package tests do not contaminate branch validation.
- `npm run prisma:check` validates `schema.prisma` and regenerates the Prisma client.
- `npm run prisma:migrate:dev -- --name <change-name>` creates a checked-in SQL migration from schema changes.
- `npm run stylelint` enforces frontend CSS and CSS Module rules.
- ArchUnitTS rules live in `tools/quality/architecture/architecture.spec.ts`.
- `npm run quality:logged` executes the main guardrails with per-step audit logs under `artifacts/audit/YYYY-MM-DD/`.
