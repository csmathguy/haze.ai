# Backend Node And TypeScript Guidance

## Defaults

- Build the backend in TypeScript on Node.js.
- Keep transport, application, domain, and adapter concerns separated.
- Prefer explicit interfaces for storage, extraction, and report generation.
- Use SQLite + Prisma for structured local persistence unless a later requirement proves the need for a server database.

## Module Shape

- `modules/`: tax-specific workflows such as document intake, extraction review, reporting
- `services/`: application services that orchestrate use cases
- `adapters/`: filesystem, OCR, document conversion, spreadsheet export, PDF generation
- `routes/` or `http/`: request mapping only, with thin controllers
- `db/`: Prisma client setup, migration helpers, and persistence adapters

## API Rules

- Validate all inbound payloads at the boundary.
- Return typed error shapes instead of ad hoc strings.
- Keep request handlers small and delegate work to services.
- Record provenance metadata for extracted fields so the frontend can explain where values came from.
- Keep Prisma model mapping inside backend services instead of leaking ORM types into shared contracts.

## File Handling

- Restrict accepted file types and file sizes.
- Treat uploaded filenames as untrusted input.
- Store files with generated internal names, not user-provided names.
- Keep raw documents outside the git-tracked source tree.

## Extraction Pipeline

- Use a strategy or adapter pattern for document-specific extraction.
- Normalize all extractor outputs into a common intermediate contract before tax mapping.
- Isolate low-level parser quirks inside adapters.
- Require confidence scores or review flags when extraction quality is uncertain.

## Local Privacy Rules

- No runtime calls to hosted AI services or hosted OCR endpoints.
- Avoid logging document text or tax identifiers.
- Prefer local child-process adapters for non-Node tooling rather than embedding cross-language concerns into domain code.
- Keep the SQLite database in ignored local storage and commit only schema, migration SQL, and tests.
