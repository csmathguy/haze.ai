---
name: parallel-work-orchestrator
description: Use this skill when a feature or refactor should be decomposed into parallel agent slices. Apply it for worktree planning, seam ownership, dependency ordering, conflict-avoidance planning, and autonomous parallel dispatch in this repository.
---

# Parallel Work Orchestrator

## Overview

This skill turns a broad task into small parallel slices that fit the repository's boundaries and minimize merge conflicts. When slices are independent, the orchestrator dispatches them simultaneously using the Agent tool in a single message so they run in parallel rather than sequentially.

## Workflow

1. Read `docs/parallel-agent-orchestration.md`.
2. Read `docs/architecture.md` and the closest stack guide for the affected area.
3. Identify contract-first seams such as `packages/shared`, `prisma/schema.prisma`, and root config.
4. Split the work into slices with one primary boundary each.
5. Create one worktree per slice with `npm run agent:worktree:create -- ...`. Worktree creation is **idempotent**: re-running the same command with the same task ID skips creation when the worktree already exists, so it is safe to use in retry loops. Pass `--force` to destroy and re-create (e.g. when the branch is in a bad state).
6. Classify each slice as **independent** or **dependent**:
   - **Independent**: no shared file overlap, no blocking dependency on another slice's output
   - **Dependent**: must wait for a contract-first slice to merge first
7. For independent slices, create all worktrees first, then dispatch all implementers in **one message** using parallel Agent tool calls (one per slice). This is the parallel path.
8. For dependent slices, create worktrees after their upstream slice is merged and dispatch sequentially.
9. Collect results from all parallel implementers before reporting completion.

## Parallel Dispatch Pattern

When dispatching independent slices in parallel, include **all** Agent tool calls in a single response. Each call should receive:

- The worktree path (already created)
- The work item ID and summary
- The allowed scope (files/directories this slice owns)
- The validation command to run before commit
- Instruction to open a PR and end the workflow

Example single-message dispatch for two independent slices:

> [Agent call 1]: implement PLAN-XX in worktree .worktrees/plan-XX, scope: tools/agent/
> [Agent call 2]: implement PLAN-YY in worktree .worktrees/plan-YY, scope: tools/planning/

Both agents run simultaneously. After both complete, collect their PR URLs and report them to the user.

## Independence Check

Two slices are **independent** when:
- They do not edit any of the same files
- Neither has `blockedByWorkItemIds` pointing to the other
- Neither touches a shared contract (packages/shared, prisma/schema.prisma) that the other reads

Two slices are **dependent** when:
- One adds a type or schema that the other imports
- One is listed in the other's `blockedByWorkItemIds`
- They both touch the same shared seam

## Result Aggregation

After all parallel agents complete, collect and report:
- PR URL for each slice
- Any warnings or errors from each implementer
- Which slices are blocked or need human resolution

If any implementer fails, mark that slice as `blocked` in the planning system and continue reporting on the others.

## Key Rules

- Prefer one owned boundary per slice.
- Do not let multiple slices edit the same shared contract without a designated seam-owner slice.
- Keep slice briefs local to the worktree and keep lasting guidance in docs or skills.
- Use `skills/workflow-audit` when the overall effort is substantial.
- Always create all worktrees before dispatching any agents (creation is serial, execution is parallel).

## When To Pull More Context

- Read `references/slice-rubric.md` when the decomposition is unclear.
- Read `docs/github-repository.md` when the merge strategy or branch protection needs to change.
