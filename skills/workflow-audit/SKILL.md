---
name: workflow-audit
description: Use this skill when work in this repository needs explicit audit logging, workflow start/end markers, or deterministic wrapper scripts for validation commands. Apply it for substantial implementation tasks, risky refactors, or whenever command traces should be stored under date-grouped folders in artifacts/audit.
---

# Workflow Audit

## Overview

This skill standardizes how agents record what they ran and when they ran it. Use it when you want a reviewable trail for workflow phases, validation commands, and command output logs.

## Workflow

1. Read `docs/agent-observability.md`.
2. Read `references/audit-steps.md`.
3. Start the workflow with `npm run workflow:start <name> "<summary>"`.
4. For long-running skills, tools, hooks, or custom operations, open an execution span with `npm run execution:start -- --workflow <name> --kind <skill|tool|hook|operation|validation> --name <label>`.
5. Add notes during longer tasks with `npm run workflow:note <name> "<note>"`.
6. Use audited wrapper scripts such as `npm run quality:logged -- <name>`.
7. Close execution spans with `npm run execution:end -- --workflow <name> --execution-id <id> --status success|failed`.
8. End the workflow with `npm run workflow:end <name> success` or `failed`.

## Key Rules

- Prefer structured audit events over free-form chat summaries when recording work.
- Prefer wrapper scripts for repeated guardrail runs.
- Keep audit data in ignored artifact paths.
- Prefer execution spans over extra workflow names when the work is nested inside an already active workflow.
- Use this skill to supplement implementation skills, not replace them.

## Public Pattern Notes

- Public skill examples consistently keep workflows focused, push details into references, and wrap repeatable command sequences in scripts. This skill follows that pattern for auditability and deterministic validation.
