---
name: workflow-task-lifecycle
description: Orchestrate the end-to-end agent task lifecycle using repository workflow statuses and sub-skills. Use when starting or advancing a task through planning, implementing, review, verification, awaiting_human, and done.
---

# Workflow Task Lifecycle

Use sub-skills in this order:
1. `workflow-start-task`
2. `backend-transition-task-status`
3. `workflow-stage-artifact`
4. `workflow-awaiting-human` (only when blocked)
5. `workflow-verify-commit-pr`

## Stage sequence
- `ready -> planning -> implementing -> review -> verification -> done`
- If blocked by missing input: move to `awaiting_human`.

## Required handoff artifacts
- Planning: plan goals, steps, risks.
- Review: files changed, summary, risks.
- Verification: commands run and outcomes.
- Awaiting Human: question + options + recommended default.

## Completion criteria
- `npm run verify` passes.
- Commit includes task reference.
- PR created for human review.
- Move to `done` only after merge/merge-ready confirmation.
