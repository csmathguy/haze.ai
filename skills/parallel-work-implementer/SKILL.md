---
name: parallel-work-implementer
description: Use this skill when implementing one pre-scoped parallel slice inside its own worktree. Apply it for bounded execution, local brief adherence, and low-conflict handoffs in this repository.
---

# Parallel Work Implementer

## Overview

This skill keeps an implementation agent inside its assigned slice so parallel work stays parallel instead of collapsing back into broad branch edits.

## Workflow

1. Read the nearest `AGENTS.md`.
2. Read `.codex-local/parallel-task.md` if it exists in the worktree.
3. Read the closest docs for the owned boundary.
4. Stay inside the allowed scope unless the orchestrator expands the slice.
5. Run the listed validation commands before handoff.
6. Report interface changes and residual conflict risks back to the orchestrator.

## Key Rules

- Do not widen the slice by editing unrelated files for convenience.
- If the brief says the slice depends on a contract-first branch, update from that branch before continuing.
- Prefer additive edits and narrow exports to large rewrites of shared files.
- Use `skills/implementation-workflow` and `skills/workflow-audit` alongside this skill when code changes are substantial.

## When To Pull More Context

- Read `references/handoff-checklist.md` when preparing a slice for PR handoff and human review.
