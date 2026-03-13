# Slice Rubric

- Start with contract-first work:
  - shared package exports
  - Prisma schema changes
  - root config or tooling interfaces
- Then create consumer slices:
  - API-only
  - web-only
  - tooling-only
- Split again if a slice would:
  - touch both `apps/api` and `apps/web`
  - edit more than one shared seam
  - mix feature work with refactor-only cleanup
- Use a final integration slice only when the handoff between earlier slices is real work.
