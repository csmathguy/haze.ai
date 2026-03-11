<!--
Optional starting point:
node tools/runtime/run-npm.cjs run pr:draft -- --base origin/main
-->

## Summary

- Describe the behavioral change in one or two sentences.
- Explain the value: what user, reviewer, workflow, or maintenance problem this solves.

## What Changed

- Group the change by repository boundary, not by commit history.
- Call out the files or modules a reviewer should start with.

Example structure:

- Database and persistence:
- Shared contracts:
- API and backend workflow:
- Web UI and client workflow:
- Tooling and automation:
- Documentation and contributor workflow:

## Review Order

1. List the best path through the diff.
2. Start with contracts, schema, or core invariants before consumers.
3. End with tooling, docs, or cleanup.

## Review Focus

- Name the highest-value checks for this PR.
- Mention contract alignment, migration safety, privacy handling, UI/API sync, or workflow impact when relevant.

## Risks

- Call out the realistic failure modes or rollout concerns.
- Say `None beyond normal regression risk` if the change is low risk.

## Validation

- [ ] `node tools/runtime/run-npm.cjs run typecheck`
- [ ] `node tools/runtime/run-npm.cjs run lint`
- [ ] `node tools/runtime/run-npm.cjs test`
- [ ] Additional focused checks for the changed areas are listed below

Commands run:

- List the exact commands you ran for this change.

## Privacy

- [ ] No private tax documents, extracted data, or generated filings were added to the repository
- [ ] Any screenshots or logs avoid SSNs, EINs, bank numbers, addresses, and full document contents

## Follow-Ups

- [ ] None
