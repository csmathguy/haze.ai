---
name: parallel-work-orchestrator
description: Use this skill when a feature or refactor should be decomposed into parallel agent slices. Apply it for worktree planning, seam ownership, dependency ordering, and conflict-avoidance planning in this repository.
---

# Parallel Work Orchestrator

## Overview

This skill turns a broad task into small parallel slices that fit the repository's boundaries and minimize merge conflicts.

## Workflow

1. Read `docs/parallel-agent-orchestration.md`.
2. Read `docs/architecture.md` and the closest stack guide for the affected area.
3. Identify contract-first seams such as `packages/shared`, `prisma/schema.prisma`, and root config.
4. Split the work into slices with one primary boundary each.
5. Create one worktree per slice with `npm run agent:worktree:create -- ...`.
6. Assign downstream slices to wait on contract-first slices when they share a seam.
7. Keep integration work as its own slice when merge or re-threading work is non-trivial.

## Key Rules

- Prefer one owned boundary per slice.
- Do not let multiple slices edit the same shared contract without a designated seam-owner slice.
- Keep slice briefs local to the worktree and keep lasting guidance in docs or skills.
- Use `skills/workflow-audit` when the overall effort is substantial.

## When To Pull More Context

- Read `references/slice-rubric.md` when the decomposition is unclear.
- Read `docs/github-repository.md` when the merge strategy or branch protection needs to change.
