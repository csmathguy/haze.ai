---
name: workflow-start-task
description: Start work on a selected task by moving it from ready/backlog to planning and attaching the initial agent plan artifact.
---

# Workflow Start Task

## Inputs
- `taskId`
- plan outline: goals, steps, risks

## Procedure
1. Read task via `GET /tasks/:id`.
2. Patch task to `planning` with `metadata.planningArtifact`.
3. If required information is missing, route to `workflow-awaiting-human`.
4. When planning is complete, transition to `implementing`.

## Output
- task id
- planned steps
- current status
