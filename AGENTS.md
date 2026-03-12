# Taxes Repository Instructions

## Scope
- This repository is for a local-only tax workflow application.
- Treat all tax documents, extracted fields, and generated filings as sensitive data.
- Do not introduce runtime dependencies that send tax data to third-party hosted services.

## Project Skills
- Use `skills/implementation-workflow` for code changes, refactors, tests, build tooling, or architecture work.
- Use `skills/planning-workflow` when scoping backlog items, tracking acceptance criteria, or associating planned work with audit workflow IDs.
- Use `skills/ui-design-workflow` for frontend UX, component design, charting, layout, accessibility, or MUI theming work.
- Use `skills/workflow-audit` when a task needs explicit workflow start/end logging, audited command execution, or a reviewable command trail.
- Use `skills/parallel-work-orchestrator` when work should be split into multiple agents or worktrees.
- Use `skills/parallel-work-implementer` when an agent is executing one bounded slice inside its own worktree.
- Use `skills/research-agent` when a task needs external research, source comparison, documentation best-practice review, or tax-law research planning with dated citations.

## Required Workflow
1. Read the relevant docs in `docs/` before making non-trivial changes.
2. Work in red-green-refactor order for behavior changes whenever practical.
3. For substantial implementation work, start an audited workflow with `npm run workflow:start implementation "<summary>"`.
4. For multi-step agent work inside an active workflow, log explicit skill, tool, hook, or operation spans with `npm run execution:start -- --workflow <name> --kind <skill|tool|hook|operation|validation> --name <label>` and close them with `npm run execution:end -- --workflow <name> --execution-id <id> --status success|failed`.
5. For Prisma schema changes, edit `prisma/schema.prisma`, create a checked-in migration with `npm run prisma:migrate:dev -- --name <change-name>`, and never hand-edit older migration folders unless explicitly instructed.
6. Regenerate and validate Prisma after schema changes with `npm run prisma:check`.
7. Before finishing, run the strongest available validation for the touched area:
   - Fast iteration: `npm run quality:changed -- <files...>` or let the git `pre-commit` hook run `npm run quality:changed:staged`
   - Database changes: `npm run prisma:check` and `npm run prisma:migrate:deploy`
   - Full compile checks with `npm run typecheck`
   - Full ESLint with `npm run lint`
   - Frontend styling changes: `npm run stylelint`
   - Full tests with `npm test` or architecture-only tests with `npm run test:arch`
   - Use `npm run quality:logged -- implementation` when you want a single audited full guardrail run
8. When the task produces branch-ready changes, make atomic commits, push the branch, and create or update the pull request before claiming the work is done. Use `node tools/runtime/run-npm.cjs run pr:sync -- --summary "<what changed>" --value "<why it matters>" --privacy-confirmed`.
9. Close audited work with `npm run workflow:end implementation success` or `failed`. Successful implementation workflows are not done until the worktree is clean and the branch has an open PR when commits exist.
10. If a command is not available yet, note the gap and update the nearest documentation or scaffold so the repo moves toward that standard.

## Architecture Rules
- Keep a strict separation between app surfaces under `apps/*/web`, `apps/*/api`, and `packages/shared`.
- `packages/shared` must stay framework-light and hold reusable domain types, schemas, and pure helpers.
- UI components should not parse raw tax documents directly. Extraction belongs behind backend application services.
- External document conversion or OCR tools must sit behind adapters so they can be swapped without rewriting business logic.
- Treat `prisma/schema.prisma` as the backend persistence contract. Keep raw uploaded files on disk, and keep structured metadata in SQLite through Prisma-backed services.
- Treat each product web app's `apps/<product>/web/src/theme/` directory as the frontend styling contract. For the current tax app, that is `apps/taxes/web/src/theme/`.
- Prefer composition over inheritance. Apply SOLID, DRY, and KISS without adding abstractions before there is a second real use case.

## Privacy And Security
- Never commit raw tax documents, generated filings, or local extracted data.
- Redact or avoid logging SSNs, EINs, bank numbers, addresses, or full document contents.
- Default to offline-capable libraries and local storage paths outside the repository for private files.

## Documentation
- Use `docs/documentation-standards.md` when writing or restructuring long-lived docs or skill references.
- Keep `docs/research-sources.md` current when adding or replacing major stack guidance.
- Update the closest architecture or workflow doc when implementation decisions change.
- Keep `.nvmrc` and `package.json` engine versions aligned with the validated local toolchain.
