# Planning Principles

Researched on March 13, 2026.

## Working Principles

- Keep the backlog ordered, transparent, and continuously refined. The item should be understandable without chat history.
- Use explicit policies for flow. A status should mean something operationally different, not just “sort of active.”
- Scope work so another agent can safely take it next. That requires clear acceptance criteria, dependencies, and a validation path.
- Prefer durable fields over prose-only notes. Projects, priorities, statuses, tasks, criteria, and plan steps should be stored, not implied.

## What “Ready” Means Here

A work item is `ready` only when:

- the target project is known
- the intended outcome is specific
- acceptance criteria are observable
- tasks are concrete enough to start
- dependencies are resolved or explicitly linked
- the validation path is understood

If any of that is missing, keep the item in `planning` or `backlog`.

## Data To Capture

For each planning item, capture:

- `projectKey`
- `title`
- `summary`
- `kind`
- `priority`
- `status`
- `acceptanceCriteria`
- `tasks`
- `blockedByWorkItemIds` when needed
- a `plan` when work spans research, design, implementation, and validation
- `auditWorkflowRunId` only when there is a real workflow to link

## Source Notes

These principles were informed by:

- The Scrum Guide on backlog refinement, ordering, and clear product backlog items.
- The Kanban Guide on managing flow through explicit policies and visible work state.
- GitHub Projects guidance on structured fields and iterations instead of free-form status notes.
- OpenAI agent workflow guidance on deterministic workflows, handoffs, and evaluation-ready task boundaries.
