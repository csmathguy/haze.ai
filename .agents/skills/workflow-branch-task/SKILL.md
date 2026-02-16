---
name: workflow-branch-task
description: Create a clean task branch from main and record branch metadata on the task before implementation begins.
---

# Workflow Branch Task

## Purpose
Ensure no implementation happens on `main` and each task has a traceable branch reference.

## Procedure
1. Ensure working tree is clean.
2. Checkout and fast-forward `main`.
3. Create branch named with task reference.
4. Record branch metadata on the task.

Preferred command:
```powershell
./scripts/start-task-branch.ps1 -TaskId "<TASK_ID>" -BranchName "task/<id>-<slug>" -BaseBranch "main"
```

## Required metadata
- `metadata.workflow.branchName`
- `metadata.workflow.baseBranch`
- `metadata.workflow.branchCreatedAt`

## Output
- task id
- branch name
- confirmation metadata saved
