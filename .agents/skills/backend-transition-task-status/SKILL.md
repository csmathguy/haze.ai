---
name: backend-transition-task-status
description: Transition a task between workflow statuses in the backend task system with guardrails and evidence. Use when moving tasks through planning, implementing, review, verification, awaiting_human, done, or cancelled.
---

# Backend Transition Task Status

## Inputs
Collect:
- `taskId` (required)
- `targetStatus` (required)
- optional `transitionNote`
- optional metadata additions

Allowed statuses:
- `backlog`
- `planning`
- `implementing`
- `review`
- `verification`
- `awaiting_human`
- `done`
- `cancelled`

## Procedure
1. Set API base URL:
```powershell
$base = if ($env:HAZE_API_BASE) { $env:HAZE_API_BASE } else { "http://localhost:3001" }
```
2. Read current task:
```powershell
$taskId = "<TASK_ID>"
$current = Invoke-RestMethod -Method Get -Uri "$base/tasks/$taskId"
$current.record
```
3. Patch target status with optional metadata note:
```powershell
$patch = @{
  status = "review"
  metadata = @{
    transitionNote = "Implementation complete; requesting review"
  }
} | ConvertTo-Json -Depth 12

Invoke-RestMethod -Method Patch -Uri "$base/tasks/$taskId" -ContentType "application/json" -Body $patch
```
4. Verify status persisted:
```powershell
Invoke-RestMethod -Method Get -Uri "$base/tasks/$taskId" | Select-Object -ExpandProperty record
```

## Guardrails
- Do not overwrite unrelated metadata keys unless explicitly requested.
- When transitioning `planning -> implementing`, ensure `metadata.testingArtifacts.planned` is populated.
- Include a concrete note when moving to `awaiting_human` with question/options/recommended default.
- Move to `done` only after verification evidence exists.

## Output
Return:
- `taskId`
- previous status
- new status
- transition note/evidence summary
