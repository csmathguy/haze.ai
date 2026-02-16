---
name: backend-next-task
description: Select and claim the next task from the backend task system. Use when the user asks to pick what to work on next based on highest priority with random tie-breaking.
---

# Backend Next Task

## Behavior
- Select only tasks with `status = backlog`.
- Prefer highest `priority`.
- If multiple tasks share highest priority, pick one at random.
- Mark selected task as `planning`.
- After claim, continue with `workflow-start-task` to capture planning artifact and advance lifecycle.

## Procedure
1. Set API base URL:
```powershell
$base = if ($env:HAZE_API_BASE) { $env:HAZE_API_BASE } else { "http://localhost:3001" }
```
2. Claim next task using deterministic script:
```powershell
./scripts/claim-next-task.ps1 -ApiBase $base
```
3. Handle no-eligible-task response:
- If output is `No eligible task available`, report the same.

## Validation
1. Confirm selected task exists and is now `planning`:
```powershell
$taskId = "<TASK_ID_FROM_RESPONSE>"
Invoke-RestMethod -Method Get -Uri "$base/tasks/$taskId" | Select-Object -ExpandProperty record
```
2. Confirm response fields include `id`, `title`, `priority`, and `status`.

## Output
Return:
- selected `taskId`
- `title`
- `priority`
- resulting `status`
- note if selection came from a tie set (if inferable from task list)
- explicit next action: run `workflow-start-task`

## Optional observability
To inspect current candidate pool before selecting:
```powershell
Invoke-RestMethod -Method Get -Uri "$base/tasks" | Select-Object -ExpandProperty records
```
