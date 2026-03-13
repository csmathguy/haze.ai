# Plan API Instructions

- Keep planning routes thin and delegate persistence logic to services.
- Treat `prisma/schema.prisma` and `prisma/migrations/` as the planning persistence contract.
- Keep planning and audit storage separate; link them only through stable external IDs such as workflow run IDs.
- Store the planning SQLite database in user-profile space by default so it can be shared across worktrees.
- Keep backend-only Prisma and filesystem logic out of `packages/shared` and frontend code.
