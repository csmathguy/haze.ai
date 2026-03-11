# Pull Request Authoring

- When drafting a pull request description, optimize for reviewer comprehension, not for a changelog.
- Start with what changed and why it matters in one or two sentences.
- Group the body by repository boundary such as database, shared contracts, API, web, tooling, and docs.
- Give reviewers an explicit review order that starts with contracts, schema, or invariants before downstream consumers.
- Add a short `Review Focus` section that names the most important checks for this specific diff.
- Add a short `Risks` section that only lists realistic failure modes implied by the changed files.
- Record the exact validation commands that were run. Do not claim checks that were not run.

# Risk Heuristics For This Repository

- `prisma/` or `prisma.config.ts`: call out schema compatibility, migration intent, and local apply steps.
- `packages/shared/`: call out cross-boundary contract risk for both `apps/api` and `apps/web`.
- `apps/api/`: call out validation, storage, privacy, and tax-data handling when relevant.
- `apps/web/`: call out user workflow changes and UI/API contract alignment.
- `tools/`, `.github/`, or root config files: call out CI, local workflow, or agent automation impact.

# Privacy And Style

- Never include raw tax document contents or personally identifying tax data in a PR body.
- Prefer precise claims tied to the diff over generic filler.
- Do not list every file unless the diff is small; summarize by area and point to the best entry points.
