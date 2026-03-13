# API Instructions

- Keep routes and transport handlers thin.
- Treat `prisma/schema.prisma` and `prisma/migrations/` as the persistence contract for structured tax data.
- Use SQLite + Prisma for metadata and domain state; keep raw uploaded files on disk under ignored local folders.
- After schema edits, run `npm run prisma:migrate:dev -- --name <change-name>`, `npm run prisma:check`, and `npm run prisma:migrate:deploy`.
- Put filesystem, OCR, conversion, and export logic behind adapters.
- Do not log raw document contents or tax identifiers.
- Prefer typed service interfaces and provenance-friendly return shapes.
- Keep backend-only dependencies out of `packages/shared`.
