# Architecture

## Recommended Structure

```text
apps/
  api/
    src/
      modules/
      services/
      adapters/
  web/
    src/
      app/
      features/
      components/
      hooks/
      theme/
packages/
  shared/
    src/
      domain/
      schemas/
      utils/
tools/
  arch/
```

## Initial Stack Direction

- Frontend: Vite + React + TypeScript
- UI library: Material UI for components and icons
- Charts: MUI X Charts first, then reevaluate only if reporting needs exceed it
- Backend: Fastify + Node.js + TypeScript
- Persistence: SQLite + Prisma with checked-in schema and SQL migrations
- Shared contracts: Zod-backed domain schemas in `packages/shared`
- Testing: Vitest for unit tests, React Testing Library for UI behavior, Playwright later for end-to-end flows
- Validation: schema-driven DTO validation in shared contracts
- Architecture enforcement: ArchUnitTS plus ESLint import restrictions

## Boundary Model

- `apps/web`
  - renders views, owns UI state, calls backend APIs
  - owns the frontend theme, reusable UI primitives, and page/layout styling rules
  - must not read private document files directly from the filesystem
- `apps/api`
  - owns file intake, extraction orchestration, storage, validation, and output generation
  - persists structured metadata in SQLite through Prisma-backed services
  - should expose application services, not raw library details
- `packages/shared`
  - contains domain vocabulary, schemas, typed contracts, and pure helpers
  - must not depend on React, browser APIs, Express-style request objects, or storage adapters

## Backend Processing Shape

1. Intake uploaded file into a local staging area outside committed source.
2. Detect document type and select an extractor strategy.
3. Convert raw content into normalized intermediate text or structured fields.
4. Run tax-domain mappers that translate extraction output into domain entities.
5. Persist reviewable results plus provenance metadata.
6. Surface uncertain fields in the frontend for manual confirmation.

## Persistence Rules

- Raw uploads stay on disk in ignored local folders.
- Structured metadata, household state, review queues, and lot records belong in SQLite.
- `prisma/schema.prisma` is the persistence contract for backend metadata.
- Migrations must be checked into `prisma/migrations/` and applied before local runtime or integration tests.

## Current Scaffold

- `apps/api`
  - `GET /api/health` for local runtime checks
  - `GET /api/workspace` for the current tax workspace snapshot
  - `POST /api/documents` for local multipart file intake
- `apps/web`
  - Vite-based React shell with upload, document ledger, review queue, and scenario surfaces
- `packages/shared`
  - tax-domain schemas for documents, lots, review tasks, scenarios, and return drafts

## Extraction Guidance

- Keep document extraction behind an interface such as `DocumentExtractor`.
- Treat tools like MarkItDown as adapters, not domain dependencies.
- Because MarkItDown is Python-based, prefer invoking it as a local process boundary if it is selected later.
- Keep OCR, PDF parsing, and spreadsheet parsing swappable by document type.

## Local-Only Design Rules

- Prefer localhost APIs between `web` and `api`.
- Store raw documents, extracted artifacts, and generated outputs in ignored local folders.
- Default to no outbound network calls during runtime.
