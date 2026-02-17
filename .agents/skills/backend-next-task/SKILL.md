---
name: backend-next-task
description: Select and claim the next task from the backend task system. Use when the user asks to pick what to work on next based on highest priority with random tie-breaking.
---

# Backend Next Task

## Behavior
- Select only tasks with `status = backlog`.
- Prefer highest `priority`.
- For priority ties, prefer tasks with the highest `dependents` count (tasks unblocked by finishing this task).
- If still tied, pick one at random.
- Mark selected task as `planning`.
- After claim, run `scripts/begin-task.ps1` to create branch + planning artifact immediately.

## Procedure
1. Set API base URL:
```powershell
$base = if ($env:HAZE_API_BASE) { $env:HAZE_API_BASE } else { "http://localhost:3001" }
```
2. Claim next task using deterministic script:
```powershell
./scripts/claim-next-task.ps1 -ApiBase $base
```
3. Begin task workflow immediately:
```powershell
./scripts/begin-task.ps1 -TaskId "<TASK_ID>" -BranchName "task/<id>-<slug>" -Goals @("...") -Steps @("...") -Risks @("...")
```
4. Handle no-eligible-task response:
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
- explicit next action: review/approve plan, then transition to `implementing`

## Optional observability
To inspect current candidate pool before selecting:
```powershell
Invoke-RestMethod -Method Get -Uri "$base/tasks" | Select-Object -ExpandProperty records
```
