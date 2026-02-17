# PR Description Standards

Last updated: 2026-02-17

## Purpose
Standardize pull request descriptions so reviewers can quickly understand scope, risk, and verification quality without reading commit history first.

## Research References
- GitHub Docs: Creating a pull request template  
  https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository
- GitHub Docs: Query parameters for prefilled PRs  
  https://docs.github.com/enterprise-cloud%40latest/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/using-query-parameters-to-create-a-pull-request
- Google Blockly: Write a good PR  
  https://developers.google.com/blockly/guides/contribute/get-started/write_a_good_pr
- AndroidX CONTRIBUTING guidance (real-world reviewer expectations)  
  https://android.googlesource.com/platform/frameworks/support/%2Bshow/f5f77abb67c2e5cde12daa57e426eebca2ce9c1d/CONTRIBUTING.md

## Required vs Optional Sections
Required sections:
- Summary
- Change type
- Testing evidence
- Risks and rollback
- Reviewer focus areas

Optional sections:
- References
- Additional context (screenshots, migration notes, rollout notes)

Rationale:
- Required sections keep review quality predictable.
- Optional sections keep high-signal but non-universal details available without forcing noise.

## Minimum Content Rules
- Summary:
  - Explain what changed and why.
  - Link the driving task/issue (`T-#####` or issue URL).
- Testing evidence:
  - Include commands actually run.
  - Include outcomes (pass/fail) and any relevant caveats.
- Risks and rollback:
  - Name the primary risk(s).
  - Provide a concrete rollback path.
- Reviewer focus:
  - Name 1-3 areas where bugs/regressions are most likely.

## Worked Examples
### Bug Fix
Summary:
- Fix status transition metadata patch ordering in `scripts/finish-task.ps1` to prevent `implementing -> review` redirect loops.
- Task: `T-00064`.

Change type:
- Bug fix

Testing evidence:
- `npm run test --workspace apps/backend -- tasks.test.ts`
- `npm run verify`
- Result: pass

Risks and rollback:
- Risk: workflow metadata edge cases in future transitions.
- Rollback: revert the script change and re-run deterministic finish flow.

Reviewer focus areas:
- Status transition validation ordering.
- Metadata patch payload integrity.

### Feature
Summary:
- Add `GET /api/workflow/status-model` and expose status details drawer in Kanban UI.
- Task: `T-00064`.

Change type:
- Feature

Testing evidence:
- Added backend + frontend tests for endpoint and drawer interactions.
- `npm run verify`
- Result: pass

Risks and rollback:
- Risk: UI interpretation drift from backend status model.
- Rollback: disable drawer entry points and revert endpoint.

Reviewer focus areas:
- API contract shape for allowed/blocked transitions.
- Drawer behavior from lane and task contexts.

### Refactor
Summary:
- Restructure task detail metadata selectors for clearer separation of workflow, timeline, and evidence fields.
- Task: `T-xxxxx`.

Change type:
- Refactor

Testing evidence:
- Existing behavior tests updated, no behavior changes intended.
- `npm run test --workspace apps/frontend -- App.test.tsx`
- `npm run lint`
- Result: pass

Risks and rollback:
- Risk: accidental UI regression in details panel sections.
- Rollback: revert refactor commit.

Reviewer focus areas:
- Behavior parity with previous detail rendering.
- Null/optional metadata handling.

## Rollout Plan
- Template location:
  - `.github/pull_request_template.md` (default template for repo PRs).
- Tool population strategy:
  - Short term: authors fill template manually using task metadata in the Kanban detail view.
  - Mid term: extend task workflow scripts to prefill PR body from task metadata (`acceptanceCriteria`, references, verification artifacts, risk notes).
  - Mid term candidate: add a script helper that opens compare URL with PR body query parameters.
- Compliance checks:
  - During review, verify required template sections are present and non-empty.
  - Add CI-level PR body linting in a follow-up task if enforcement becomes necessary.
