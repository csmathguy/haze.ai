---
name: planning-session
description: "Use this skill when a request needs a real planning pass before implementation: research-backed decomposition, project-scoped backlog creation, acceptance criteria, dependencies, and durable plan steps for later agents."
---

# Planning Session

## Overview

Use this skill to convert a request into project-scoped work items that agents can execute without relying on chat history. It is the entry skill for backlog intake, decomposition, and "future work" capture.

Read `references/planning-principles.md` before creating or refining items.

## When To Use It

- A request spans multiple steps, handoffs, or follow-up work.
- The user asks to brainstorm, scope, break down, or plan work.
- A new project area needs backlog structure before implementation begins.
- Research findings need to be turned into explicit work items.

## Workflow

1. Read `AGENTS.md`, `docs/architecture.md`, and `docs/agent-guidelines.md`.
2. If external guidance matters, use `skills/research-agent` first and keep dated sources in `docs/research-sources.md`.
3. Inspect the current planning workspace:

```bash
npm run plan:cli -- workspace get
```

4. Choose the target project:
   - Use `planning`, `audit`, or `taxes` when one fits.
   - Create a project only when the work does not fit an existing project.

```bash
npm run plan:cli -- project create --key reporting --name "Reporting" --description "Cross-system reporting and dashboards"
```

5. Create one work item per independently shippable change. Include:
   - `projectKey`
   - concise title and summary
   - kind and priority
   - observable acceptance criteria
   - implementation tasks
   - plan steps when research, design, implementation, and validation are distinct
   - dependency IDs when work is not actually ready

6. Set initial status deliberately:
   - `backlog` when it is captured but not yet shaped
   - `planning` when decomposition is still in progress
   - `ready` only when another agent could start safely

7. If the current request is too large, split it and add the follow-up items now instead of relying on memory.

## Command Pattern

Create a JSON payload, then persist it with the CLI:

```bash
npm run plan:cli -- work-item create --json-file .tmp/planning-item.json
```

Recommended payload shape:

```json
{
  "projectKey": "planning",
  "title": "Kanban board MVP",
  "summary": "Add a board view so work flows are visible by status.",
  "kind": "feature",
  "priority": "high",
  "acceptanceCriteria": [
    "The board groups work items by status.",
    "Users can move items between columns."
  ],
  "tasks": [
    "Design board queries",
    "Render grouped columns",
    "Persist status changes"
  ],
  "plan": {
    "mode": "parallel-agents",
    "summary": "Implement and validate the first board slice.",
    "steps": [
      "Confirm board scope and constraints",
      "Implement API and UI updates",
      "Validate drag or move behavior"
    ]
  }
}
```

## Rules

- Do not create flat "miscellaneous" backlog items. Split by shippable outcome.
- Acceptance criteria should describe outcomes, not code edits.
- Leave dependencies explicit. A blocked item should not masquerade as ready work.
- If a planning session reveals future work, persist it immediately with separate backlog items.
- Keep planning and audit separate; link them with workflow IDs, not shared persistence assumptions.
