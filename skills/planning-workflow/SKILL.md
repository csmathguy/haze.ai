---
name: planning-workflow
description: Use this skill when scoping work, creating or refining backlog items, recording acceptance criteria, or linking planned work to audit workflow IDs. Apply it before substantial implementation, when decomposing work for parallel agents, or when selecting the next ready item from the backlog.
---

# Planning Workflow

## Overview

This skill keeps planning data explicit, reviewable, and durable across worktrees. Use it as the umbrella planning workflow, then prefer `skills/planning-session` for backlog intake and decomposition and `skills/planning-execution` for in-flight work updates.

## Workflow

1. Read `AGENTS.md`, `docs/architecture.md`, and `docs/agent-guidelines.md`.
2. If the request needs external guidance, use `skills/research-agent` first and record dated findings.
3. Inspect the current queue with `npm run plan:cli -- workspace get` or `npm run plan:cli -- work-item next --project-key <key>`.
4. Create or update a planning work item before substantial implementation when the work spans multiple steps or agent handoffs.
5. Capture, at minimum:
   - title and summary
   - project key
   - work item kind and priority
   - acceptance criteria
   - implementation tasks
   - plan steps, especially when research, design, implementation, and validation are separate phases
6. Before code work begins, make the execution lifecycle explicit:
   - item exists in planning
   - item is truthfully `planning` or `ready`
   - dedicated worktree will be created for the owned slice
   - active workflow run ID and owner will be written back when execution starts
7. When an audited implementation workflow exists, store its workflow run ID on the work item or plan run as an external reference.
8. Move work item status through `backlog`, `planning`, `ready`, `in-progress`, `blocked`, and `done` instead of leaving progress implicit.
9. Prefer one backlog item per independently shippable change. Split oversized work before implementation.
10. Keep dependencies explicit so future agents can safely pull the next ready item.
11. During execution, append newly discovered tasks or criteria instead of leaving scope changes in chat-only notes.
12. When execution, research, or review uncovers future work that should not be done in the current slice, create a separate backlog item immediately instead of leaving the idea in chat, docs, or a pull request note.

## Key Rules

- Planning data and audit data are separate concerns. Link them with stable IDs, not cross-database assumptions.
- Acceptance criteria should describe observable outcomes, not implementation trivia.
- Plan steps should be ordered and concise enough that another agent can pick them up without chat history.
- If a work item cannot be validated yet, leave it `blocked` or `planning` instead of marking it ready.
- Future ideas, deferred work, and "later" enhancements are planning data. Persist them as separate work items with a truthful status instead of burying them in prose.
- When the same planning friction repeats, improve this skill or the planning app instead of relying on memory.
