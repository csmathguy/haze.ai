---
name: backend-update-task
description: Update an existing task in the local backend task system via HTTP API. Use when the user asks to change task status, dependencies, priority, due date, tags, or metadata.
---

# Backend Update Task

## Inputs
Collect:
- `taskId` (required)
- fields to patch (one or more): `title`, `description`, `priority`, `status`, `dependencies`, `dueAt`, `tags`, `metadata`

## Procedure
1. Set API base URL:
```powershell
$base = if ($env:HAZE_API_BASE) { $env:HAZE_API_BASE } else { "http://localhost:3001" }
```
2. Build patch body with only changed fields:
```powershell
$patch = @{
  status = "in_progress"
  priority = 4
} | ConvertTo-Json -Depth 10

$taskId = "<TASK_ID>"
$response = Invoke-RestMethod -Method Patch -Uri "$base/tasks/$taskId" -ContentType "application/json" -Body $patch
$response.record
```
3. Verify exact record state:
```powershell
Invoke-RestMethod -Method Get -Uri "$base/tasks/$taskId" | Select-Object -ExpandProperty record
```

## Output
Return:
- `taskId`
- changed fields and resulting values
- resulting `updatedAt`
- error details if backend validation rejects the update
