---
name: planning-workflow
description: Use this skill when scoping work, creating or refining backlog items, recording acceptance criteria, or linking planned work to audit workflow IDs. Apply it before substantial implementation, when decomposing work for parallel agents, or when selecting the next ready item from the backlog.
---

# Planning Workflow

## Overview

This skill keeps planning data explicit, reviewable, and durable across worktrees. Use it to turn a request into a tracked work item with tasks, acceptance criteria, plan steps, and audit references before implementation starts.

## Workflow

1. Read `AGENTS.md`, `docs/architecture.md`, and `docs/agent-guidelines.md`.
2. If the request needs external guidance, use `skills/research-agent` first and record dated findings.
3. Create or update a planning work item before substantial implementation when the work spans multiple steps or agent handoffs.
4. Capture, at minimum:
   - title and summary
   - work item kind and priority
   - acceptance criteria
   - implementation tasks
   - plan steps, especially when research, design, implementation, and validation are separate phases
5. When an audited implementation workflow exists, store its workflow run ID on the work item or plan run as an external reference.
6. Move work item status through `backlog`, `planning`, `ready`, `in-progress`, `blocked`, and `done` instead of leaving progress implicit.
7. Prefer one backlog item per independently shippable change. Split oversized work before implementation.
8. Keep dependencies explicit so future agents can safely pull the next ready item.

## Key Rules

- Planning data and audit data are separate concerns. Link them with stable IDs, not cross-database assumptions.
- Acceptance criteria should describe observable outcomes, not implementation trivia.
- Plan steps should be ordered and concise enough that another agent can pick them up without chat history.
- If a work item cannot be validated yet, leave it `blocked` or `planning` instead of marking it ready.
- When the same planning friction repeats, improve this skill or the planning app instead of relying on memory.
