---
name: workflow-verify-commit-pr
description: Run verification, stage files, commit changes, and open a GitHub PR using deterministic commands.
---

# Workflow Verify Commit PR

## Inputs
- commit message
- PR title
- optional PR body file path

## Procedure
1. Run `npm run verify`.
2. Stage files with `git add`.
3. Commit with task-linked message.
4. Push branch to remote with `git push origin HEAD`.
5. Run `scripts/create-pr.ps1 -Title "<TITLE>" [-BodyFile <path>]`.
6. Record PR URL in task metadata review or done artifact.

## Guardrails
- Stop if verification fails.
- Stop if `git push origin HEAD` fails.
- Do not open PR with unverified changes.
- Keep commit scope limited to active task.
