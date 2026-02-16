# Task Workflow Lifecycle Standard

Last updated: 2026-02-16

## Status flow
`backlog -> ready -> planning -> implementing -> review -> verification -> done`

Branch path:
- `awaiting_human` can be entered from `planning`, `implementing`, `review`, or `verification` when required input is missing.
- Human response returns task to `ready` (or `planning` if scope stays unchanged).

## Required stage artifacts
- `planning`: `metadata.planningArtifact`
- `review`: `metadata.reviewArtifact`
- `verification`: `metadata.verificationArtifact`
- `awaiting_human`: `metadata.awaitingHumanArtifact`
- `done`: `metadata.doneArtifact`

## Stage gates
- Enter `ready` only when objective, acceptance criteria, dependencies, and required inputs are present.
- Enter `review` only when implementation changes and impact summary are recorded.
- Enter `verification` only after review feedback is addressed.
- Enter `done` only after verification passes and merge/merge-ready state is recorded.

## Git and PR flow
1. Start from clean branch named with task id (for example: `task/T-00042-kanban-card-readability`).
2. Record branch metadata on task:
   - `metadata.workflow.branchName`
   - `metadata.workflow.baseBranch`
   - `metadata.workflow.branchCreatedAt`
3. Implement and verify locally (`npm run verify`).
4. Commit with task reference.
5. Push branch with `git push origin HEAD`.
6. Create PR using deterministic command path (see `scripts/create-pr.ps1`).
7. Move task to `done` only after PR approval and merge (or explicit merge-ready policy).

Mandatory rule:
- Never implement directly on `main`.

## ID policy target
- New canonical task id format: `T-#####`.
- Use `scripts/next-task-id.ps1` to suggest next id until backend-native allocation is implemented.
