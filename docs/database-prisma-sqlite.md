# Database: Prisma And SQLite

## Default Approach

- Use SQLite for local-only persisted tax metadata and workflow state.
- Use Prisma as the schema contract, query layer, and client generation tool.
- Keep raw uploads on disk and store structured facts, review state, and lot data in SQLite.

## Source Of Truth

- `prisma/schema.prisma` defines the persisted model.
- `prisma/migrations/` contains checked-in SQL migrations.
- `DATABASE_URL` defaults to `file:./data/sqlite/taxes.db`.

## Workflow

1. Edit `prisma/schema.prisma`.
2. Run `npm run prisma:migrate:dev -- --name <change-name>`.
3. Review the generated SQL in `prisma/migrations/<timestamp>_<change-name>/migration.sql`.
4. Run `npm run prisma:check`.
5. Run `npm run prisma:migrate:deploy`.
6. Run `npm run typecheck`, `npm run lint`, and `npm test`.

## Guardrails

- Do not hand-edit older migration directories.
- Do not manually edit the SQLite database file.
- Do not bypass `schema.prisma` for structural changes.
- Keep migrations in git with the code change that requires them.
- Keep database-specific logic in backend services or adapters, not in `packages/shared` or the frontend.

## Runtime Notes

- SQLite runs in WAL mode with foreign keys enabled for the local metadata store.
- Tests should use isolated SQLite files and apply the checked-in migrations before exercising persistence code.
- Prisma validation and client generation are part of the repository guardrails through `npm run prisma:check`.
