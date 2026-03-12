# Pull Request Standards

## Goal

Pull requests in this repository should let a reviewer answer four questions quickly:

1. What changed?
2. Why does it matter?
3. Where should I start reviewing?
4. What could break?

That matters more here because a growing share of changes will be produced by agents. The PR body is the human checkpoint.

Non-draft pull requests targeting `main` are also checked by `.github/workflows/pr-hygiene.yml`, which verifies that the required sections below are still present before review proceeds.

## Required Sections

### Summary

- State the behavioral change in one or two sentences.
- State the value of the change, not just the implementation detail.

### What Changed

- Group the diff by repository boundary:
  - database and persistence
  - shared contracts
  - API and backend workflow
  - web UI and client workflow
  - tooling and automation
  - documentation and contributor workflow
- Name the main files, modules, or seams a reviewer should open first.

### Review Order

- Give reviewers a path through the diff.
- Start with contracts, schema, or invariants.
- Move to backend and frontend consumers after that.
- End with tooling, docs, and cleanup.

### Review Focus

- Name the most important checks for this PR, not a generic checklist.
- Examples:
  - schema and migration safety
  - shared contract alignment across API and web
  - privacy-sensitive handling in backend flows
  - UI/API synchronization
  - local workflow or CI impact

### Risks

- List realistic failure modes or rollout concerns.
- If there is no unusual risk, say that explicitly.

### Validation

- Record the exact commands that were run.
- Include focused checks when the change touches one boundary more heavily than others.

### Privacy

- Confirm no tax documents, extracted data, or generated filings were added.
- Avoid screenshots or logs that reveal SSNs, EINs, addresses, bank numbers, or full document contents.

## Review Heuristics By Changed Area

### `prisma/` And Persistence Changes

- Review `prisma/schema.prisma` and the migration first.
- Check compatibility assumptions and whether local migration apply steps are documented.

### `packages/shared/`

- Review shared contracts before reviewing API or web consumers.
- Confirm every downstream consumer was updated consistently.

### `apps/*/api/`

- Focus on request validation, service boundaries, file handling, persistence, and privacy controls.

### `apps/*/web/`

- Focus on the user workflow, API assumptions, and any reviewer-visible regressions.

### `tools/`, `.github/`, And Root Config

- Focus on whether local development, CI, audits, and agent workflows still behave as intended.

## Optional Helper

Use the local draft helper to generate a first-pass PR body from changed files:

```powershell
node tools/runtime/run-npm.cjs run pr:draft -- --base origin/main
```

For local uncommitted work instead of branch diff review:

```powershell
node tools/runtime/run-npm.cjs run pr:draft
```

The helper does not replace author judgment. It only suggests structure, review order, and likely risk areas from the changed paths.

## Publication Workflow

For branch-ready work, PR creation is part of definition of done, not a follow-up request.

1. Finish the implementation and run the required validation.
2. Commit the finished work in atomic commits so the worktree is clean.
3. Run:

```powershell
node tools/runtime/run-npm.cjs run pr:sync -- --summary "<what changed>" --value "<why it matters>" --privacy-confirmed
```

That command pushes the current branch and creates or updates the PR using the generated review sections plus the validation commands recorded in the current or latest workflow audit summary.

## GitHub Review Automation

- `.github/CODEOWNERS` lets GitHub request the repository owner as a reviewer automatically when a pull request is ready for review.
- `.github/workflows/pr-hygiene.yml` enforces the required section headings on pull requests so review starts with the expected context.
