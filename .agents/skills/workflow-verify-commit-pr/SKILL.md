---
name: workflow-verify-commit-pr
description: Run verification, stage files, commit changes, and open a GitHub PR using deterministic commands.
---

# Workflow Verify Commit PR

## Inputs
- task id
- commit message
- PR title
- optional PR body file path

## Procedure
1. Run `scripts/finish-task.ps1 -TaskId "<TASK_ID>" -CommitMessage "<MSG>" -PrTitle "<TITLE>" [-PrBodyFile <path>]`.
2. Confirm command output includes commit SHA, PR URL, and task status transitioned to `review`.
3. If script fails, stop and report exact failure; do not replace with manual git/PR commands in normal flow.

## Guardrails
- Stop if verification fails.
- Stop if `git push origin HEAD` fails.
- Do not open PR with unverified changes.
- Keep commit scope limited to active task.
- Never mark `done` from this skill; it should stop at `review`.
- Update task stage through backend API only (`PATCH /tasks/:id`); do not edit task JSON files directly.
- Treat `scripts/finish-task.ps1` as the single deterministic completion path for this repository workflow.
