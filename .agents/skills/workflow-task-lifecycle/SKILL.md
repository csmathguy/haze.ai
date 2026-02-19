---
name: workflow-task-lifecycle
description: Orchestrate the end-to-end agent task lifecycle using repository workflow statuses and sub-skills. Use when starting or advancing a task through planning, implementing, review, verification, awaiting_human, and done.
---

# Workflow Task Lifecycle

Use sub-skills in this order:
1. `workflow-branch-task`
2. `workflow-start-task`
3. `backend-transition-task-status`
4. `workflow-stage-artifact`
5. `architecture-modularity-review` (required for code changes before finish)
6. `workflow-awaiting-human` (only when blocked)
7. `workflow-verify-commit-pr`

## Stage sequence
- `backlog -> planning -> implementing -> review -> verification -> done`
- If blocked by missing input: move to `awaiting_human`.
- Require explicit plan approval before `planning -> implementing`.

## Required handoff artifacts
- Planning: plan goals, steps, risks.
- Planning: `testingArtifacts.planned` with Gherkin + unit/integration intent.
- Review: files changed, summary, risks.
- Verification: commands run and outcomes.
- Review/Verification: `testingArtifacts.implemented` with test files/evidence/commands.
- Awaiting Human: question + options + recommended default.

## Completion criteria
- `npm run verify` passes.
- Commit includes task reference.
- PR created for human review.
- Move to `done` only after merge confirmation.
- Completion handoff must run through `workflow-verify-commit-pr` (`scripts/finish-task.ps1`) instead of manual git/PR commands.
- Once completion criteria are met, trigger `workflow-verify-commit-pr` automatically without waiting for additional confirmation unless the user explicitly asks to hold.

## Branch gate
- Never implement on `main`.
- Every task must include `metadata.workflow.branchName` and `metadata.workflow.baseBranch` before entering `implementing`.
