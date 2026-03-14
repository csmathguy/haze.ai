# Knowledge API Instructions

- Keep knowledge routes thin and delegate persistence logic to services.
- Treat `prisma/schema.prisma` and `prisma/migrations/` as the knowledge persistence contract.
- Keep repository-doc synchronization behind backend services instead of exposing filesystem details to the frontend.
- Store the knowledge SQLite database in user-profile space by default so it can be shared across worktrees.
- Design knowledge for both agent retrieval and human review: preserve typed structure, provenance, and review timestamps.
