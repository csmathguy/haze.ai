# GitHub Repository Setup

## Files Added In-Repo

- `.github/workflows/ci.yml`
- `.github/workflows/pr-hygiene.yml`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
- `.github/copilot-instructions.md`
- `.github/CODEOWNERS`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `.editorconfig`
- `.gitattributes`

These provide the repository baseline, but a few settings still must be enabled in the GitHub UI.

## Recommended Manual Settings

### Ruleset For `main`

Create a branch ruleset for `main` with:

- require pull requests before merging
- require at least one approval
- require review from code owners
- require status checks before merging
- require branches to be up to date before merging
- require conversation resolution before merging
- block force pushes
- block branch deletion
- require a linear history

Set the required status checks to:

- `prisma-check`
- `typecheck`
- `lint`
- `stylelint`
- `test-coverage`

If you enable GitHub's merge queue later, keep `.github/workflows/ci.yml` listening to `merge_group` so those required checks still run for queued merges.

### Dependency Visibility

Enable the dependency graph in Settings > Advanced Security. This lets GitHub parse the lockfile and surface dependency data and alerts.

### Dependabot

After the dependency graph is enabled, review Dependabot alerts and keep `.github/dependabot.yml` active for version updates.

### Secret Scanning

If this repository is public, GitHub secret scanning runs automatically. If it remains a user-owned private repository, secret scanning availability depends on the account plan and GitHub environment. That limitation is based on the GitHub documentation listed in `docs/research-sources.md`.

Regardless of GitHub plan, treat secret scanning as a backstop, not the primary control. Private tax data must never be committed.

## Why This Baseline

- CI verifies Prisma validation, type safety, linting, styling, and coverage in separate required checks on pull requests and main-branch pushes.
- Dependabot keeps action and npm versions moving without manual tracking.
- The PR hygiene workflow validates the repository's required PR sections before review on non-draft pull requests.
- Templates, Copilot instructions, and CODEOWNERS give GitHub enough structure to request review automatically and keep review quality consistent once the ruleset is enabled.

## Pull Request Review Quality

- Use `docs/pull-request-standards.md` as the repository standard for PR summaries, review order, risks, and validation notes.
- Use `node tools/runtime/run-npm.cjs run pr:draft -- --base origin/main` to generate a first-pass PR body from the changed files in a branch.
- Use `node tools/runtime/run-npm.cjs run pr:sync -- --summary "<what changed>" --value "<why it matters>" --privacy-confirmed` to push the branch and create or update the PR as the final publication step for branch-ready work.
- Keep PR merge as a human-only action after review. Agents publish the branch and PR, then stop short of merge.
