---
name: planning-execution
description: "Use this skill when an agent is executing from the backlog: pull the next item, update status, enrich tasks or criteria during discovery, and close the loop with durable planning data."
---

# Planning Execution

## Overview

Use this skill while implementing work that is already in the planning system. It keeps execution state, newly discovered scope, and validation progress synchronized with the shared planning database.

Read `references/plan-cli-recipes.md` before updating work items.

## When To Use It

- An agent needs the next actionable planning item.
- A workflow should update status or ownership before implementation starts.
- New tasks or acceptance criteria are discovered mid-flight.
- A work item needs to be marked blocked, done, or linked to an audit workflow.

## Workflow

1. Read the current queue or request the next actionable item:

```bash
npm run plan:cli -- work-item next --project-key planning
```

2. When work begins, update the item with the current owner, workflow ID, and status:

```bash
npm run plan:cli -- work-item update --id PLAN-12 --json-file .tmp/planning-update.json
```

3. As discovery happens, append new tasks or acceptance criteria instead of keeping them only in notes.

4. Update checklist progress directly from the CLI:

```bash
npm run plan:cli -- task set-status --work-item-id PLAN-12 --task-id <task-id> --status done
npm run plan:cli -- criterion set-status --work-item-id PLAN-12 --criterion-id <criterion-id> --status passed
```

5. If implementation exposes follow-up work, create separate backlog items rather than overloading the current one.

6. Finish by leaving the item in a truthful state:
   - `done` when the item is actually complete
   - `blocked` when an unresolved dependency stops progress
   - `planning` when scope has changed and needs replanning

## Rules

- Do not silently change scope. Add tasks, criteria, or follow-up items.
- Do not mark an item `done` while criteria still describe unverified outcomes.
- Keep audit linkage lightweight. Store workflow IDs, not duplicate audit records.
- Prefer small updates during execution over a large stale rewrite at the end.
