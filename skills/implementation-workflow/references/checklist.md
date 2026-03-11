# Implementation Checklist

## Before Editing

- Read `docs/architecture.md` and the closest stack-specific guide.
- Confirm which boundary is affected: `apps/web`, `apps/api`, or `packages/shared`.
- Decide the test seam before changing behavior.
- For substantial work, start an audit run with `npm run workflow:start implementation "<summary>"`.

## During The Change

- Start with a failing test when behavior changes.
- Keep UI, API, and shared logic in their intended layers.
- Route document parsing and conversion through adapters, not feature code.
- For database changes, update `prisma/schema.prisma` first and create a new checked-in migration.

## Before Finishing

- Run `npm run prisma:check` when Prisma or database code changed.
- Run `npm run prisma:migrate:deploy` when the local database shape must be applied or refreshed.
- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm run stylelint` when frontend CSS or styling structure changed.
- Run `npm test`, `npm run test:arch`, or `npm run quality:logged -- implementation`.
- If architecture changed, update `docs/architecture.md` or `docs/architecture-enforcement.md`.
- If a new major tool or practice was introduced, update `docs/research-sources.md`.
- End the workflow with `npm run workflow:end implementation success`.
