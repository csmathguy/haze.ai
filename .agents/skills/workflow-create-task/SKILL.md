---
name: workflow-create-task
description: Create a new workflow task using canonical T-##### id suggestion and backend task creation APIs.
---

# Workflow Create Task

## Procedure
1. Suggest next canonical id:
```powershell
./scripts/next-task-id.ps1
```
2. Create task via backend API using `backend-add-task` skill.
3. Store canonical id in metadata until backend-native id allocation exists:
- `metadata.canonicalTaskId = "T-00042"`
4. Validate task appears in `GET /tasks`.

## Output
- backend task id
- canonical task id suggestion
- initial status and priority
