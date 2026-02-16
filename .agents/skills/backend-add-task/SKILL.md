---
name: backend-add-task
description: Create a task in the local backend task system via HTTP API. Use when the user asks to add a task, capture backlog items, or create new Kanban work records.
---

# Backend Add Task

## Inputs
Collect:
- `title` (required)
- `description` (optional)
- `priority` (1-5, default 3)
- `dependencies` (optional task id array)
- `dueAt` (optional ISO datetime or null)
- `tags` (optional string array)
- `metadata` (optional object)

## Procedure
1. Set API base URL:
```powershell
$base = if ($env:HAZE_API_BASE) { $env:HAZE_API_BASE } else { "http://localhost:3001" }
```
2. Submit create request:
```powershell
$payload = @{
  title = "<TASK_TITLE>"
  description = "<DESCRIPTION>"
  priority = 3
  dependencies = @()
  dueAt = $null
  tags = @("backlog")
  metadata = @{}
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Method Post -Uri "$base/tasks" -ContentType "application/json" -Body $payload
$response.record
```
3. Verify task is persisted:
```powershell
Invoke-RestMethod -Method Get -Uri "$base/tasks" | Select-Object -ExpandProperty records
```

## Output
Return:
- created `id`
- `title`
- `status`
- any validation warning (for example dependency references)
