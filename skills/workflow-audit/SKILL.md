---
name: workflow-audit
description: Use this skill when work in this repository needs explicit audit logging, workflow start/end markers, deterministic wrapper scripts for validation commands, or live visibility in the shared audit monitor. Apply it for substantial implementation tasks, risky refactors, or whenever command traces should be stored in the shared audit database and mirrored artifact folders.
---

# Workflow Audit

## Overview

This skill standardizes how agents record what they ran and when they ran it. Use it when you want a reviewable trail for workflow phases, validation commands, and command output logs.

## Workflow

1. Read `docs/agent-observability.md`.
2. Read `references/audit-steps.md`.
3. Start the workflow with `npm run workflow:start <name> "<summary>"`.
4. For long-running skills, tools, hooks, or custom operations, open an execution span with `npm run execution:start -- --workflow <name> --kind <skill|tool|hook|operation|validation> --name <label>`.
5. When the work includes meaningful choices, outputs, classified failures, or agent-to-agent transitions, log them explicitly with `npm run audit:decision`, `npm run audit:artifact`, `npm run audit:failure`, and `npm run audit:handoff`.
6. Add notes during longer tasks with `npm run workflow:note <name> "<note>"`.
7. Use audited wrapper scripts such as `npm run quality:logged -- <name>`.
8. Close execution spans with `npm run execution:end -- --workflow <name> --execution-id <id> --status success|failed`.
9. End the workflow with `npm run workflow:end <name> success` or `failed`.

## Key Rules

- Prefer structured audit events over free-form chat summaries when recording work.
- Prefer typed decision/artifact/failure records over burying those details in workflow notes.
- Prefer passing `--work-item-id`, `--plan-run-id`, and `--plan-step-id` at workflow start when the work maps to a planning item.
- Prefer explicit handoff records when work changes owners between agents or worktrees.
- Prefer wrapper scripts for repeated guardrail runs.
- Keep audit data in ignored artifact paths and the shared local audit database.
- Prefer execution spans over extra workflow names when the work is nested inside an already active workflow.
- Use this skill to supplement implementation skills, not replace them.

## Public Pattern Notes

- Public skill examples consistently keep workflows focused, push details into references, and wrap repeatable command sequences in scripts. This skill follows that pattern for auditability and deterministic validation.
