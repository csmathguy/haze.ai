---
name: implementation-workflow
description: Use this skill when implementing, refactoring, testing, or restructuring code in this repository. Apply it for changes in apps/*/web, apps/*/api, packages/shared, tooling, tests, or architecture docs.
---

# Implementation Workflow

## Overview

This skill keeps code changes aligned with the repository's local-only privacy requirements, architecture boundaries, and quality gates. Use it whenever a task affects behavior, tests, build tooling, or project structure.

## Workflow

1. Read `AGENTS.md`, then the closest docs in `docs/`.
2. Read `references/checklist.md` if the change is more than trivial.
3. For substantial work, start an audited workflow with `npm run workflow:start implementation "<summary>"`.
4. For nested agent phases such as skill execution, tool invocation, or custom validation passes, use `npm run execution:start` and `npm run execution:end` inside the active workflow.
5. Identify the boundary being changed: `apps/*/web`, `apps/*/api`, `packages/shared`, or `tools`.
6. For behavior changes, write or update a failing test first.
7. Implement the smallest change that makes the test pass.
8. Refactor only after behavior is green.
9. Run the strongest available validation for the touched scope.
10. Commit the finished work in atomic commits, then run `node tools/runtime/run-npm.cjs run pr:sync -- --summary "<what changed>" --value "<why it matters>" --privacy-confirmed` to push the branch and create or update the PR.
11. Stop at PR publication. Do not merge the pull request from the implementation workflow.
12. Close the workflow with `npm run workflow:end implementation success` or `failed`.

## Key Rules

- Do not let frontend code parse raw tax documents.
- Keep extraction, OCR, and conversion tools behind backend adapters.
- Keep shared packages free of React and backend transport concerns.
- Prefer `npm run quality:logged -- implementation` over hand-running the whole guardrail stack.
- Use `npm run typecheck`, `npm run lint`, and targeted tests as the minimum completion bar when those commands exist.
- Treat an open PR as part of definition of done for branch-ready work, not as optional follow-up.
- Treat merge approval as human-only and outside the implementation agent's authority.
- If the repo lacks a needed script or guardrail, document the gap and move the scaffold toward that standard.

## When To Pull More Context

- Read `docs/testing-and-quality.md` when the task changes behavior or test strategy.
- Read `docs/architecture-enforcement.md` when imports, packages, or layering are affected.
- Read the frontend or backend guide when the task is stack-specific.
