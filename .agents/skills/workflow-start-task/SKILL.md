---
name: workflow-start-task
description: Start work on a selected task by creating branch + planning artifact and leaving it in planning for approval.
---

# Workflow Start Task

## Inputs
- `taskId`
- plan outline: goals, steps, risks

## Procedure
1. Run deterministic script:
```powershell
./scripts/begin-task.ps1 -TaskId "<TASK_ID>" -Goals @("...") -Steps @("...") -Risks @("...")
```
2. Verify task includes:
- `metadata.workflow.branchName`
- `metadata.workflow.baseBranch`
- `metadata.workflow.owner`
- `metadata.planningArtifact`
- `metadata.testingArtifacts.planned` (Gherkin + unit/integration testing intent scaffold)
3. Keep task in `planning` until plan approval.
4. If required information is missing, route to `workflow-awaiting-human`.
5. After approval, transition to `implementing`.

## Output
- task id
- planned steps
- current status
