---
name: parallel-work-implementer
description: Use this skill when implementing one pre-scoped parallel slice inside its own worktree. Apply it for bounded execution, local brief adherence, and low-conflict handoffs in this repository.
---

# Parallel Work Implementer

<!-- Recommended model tier: T2 (Sonnet) — implementing a single bounded slice with clear scope -->

## Overview

This skill keeps an implementation agent inside its assigned slice so parallel work stays parallel instead of collapsing back into broad branch edits. It is invoked by the parallel-work-orchestrator for each independent slice.

## Workflow

1. Read the nearest `AGENTS.md`.
2. Read `.codex-local/parallel-task.md` if it exists in the worktree.
3. **File discovery pre-pass** — if the slice scope covers multiple unknown files, run before reading code:
   ```bash
   npm run agent:discover-files -- --task "<slice description>" --max 10
   ```
   Limit initial file reads to the returned paths. Skip when the slice brief already lists exact files.
4. Read the closest docs for the owned boundary.
5. Start the audited workflow: `node tools/runtime/run-npm.cjs run workflow:start implementation "<task summary>"`.
   Log an initial heartbeat: `npm run agent:heartbeat -- --message 'workflow started'`
6. Implement only within the allowed scope. Do not edit files outside the declared boundary.
   Log a heartbeat after each major phase: `npm run agent:heartbeat -- --message '<phase description>'`
7. Run validation: `node tools/runtime/run-npm.cjs run quality:changed -- <changed files>`.
   Log a heartbeat: `npm run agent:heartbeat -- --message 'validation passed'`
8. Commit changes and push the branch.
9. Open the PR: `node tools/runtime/run-npm.cjs run pr:sync -- --summary "..." --value "..." --privacy-confirmed`.
   Log a final heartbeat: `npm run agent:heartbeat -- --message 'PR opened, handoff complete'`
10. End the workflow: `node tools/runtime/run-npm.cjs run workflow:end implementation success`.
11. Report back to the orchestrator: the PR URL, any warnings, and any residual conflict risks.

## What the Task Prompt Should Contain

When dispatched by the orchestrator, the task prompt should specify:

```
Work item: PLAN-XX — <title>
Worktree: C:/Users/.../Taxes/.worktrees/plan-XX
Allowed scope: <directory or file list>
Validation: npm run quality:changed -- <files>
```

The implementer reads `.codex-local/parallel-task.md` for additional context if present.

## Key Rules

- Do not widen the slice by editing unrelated files for convenience.
- If the brief says the slice depends on a contract-first branch, update from that branch before continuing.
- Prefer additive edits and narrow exports to large rewrites of shared files.
- Use `skills/implementation-workflow` and `skills/workflow-audit` alongside this skill when code changes are substantial.
- Do **not** merge the PR — PR merge is a human action.

## When To Pull More Context

- Read `references/handoff-checklist.md` when preparing a slice for PR handoff and human review.
