# Agent Observability

## Goal

Make agent work reviewable without relying on hidden state or chat history alone.

## Approach

This repository uses script-based audit logging rather than product-native hooks. The current OpenAI and Codex material reviewed for this repository documents `AGENTS.md` support and repository instructions, but I did not find a documented repo-local hook system comparable to Claude Code hooks. That is an inference from the sources listed in `research-sources.md`.

The audit model is span-based:

- a workflow run is the root container
- nested executions record skills, tools, hooks, validations, operations, and commands
- each execution writes paired `execution-start` and `execution-end` events with IDs and optional parent linkage
- run summaries keep both legacy `steps` for command output and richer `executions` plus aggregated `stats`
- runs now carry optional audit context for `project`, `workItemId`, `planRunId`, `planStepId`, `agentName`, and `sessionId`
- first-class typed records capture `decision`, `artifact`, `failure`, and `handoff` data instead of forcing those details into free-form notes

That shape is intentionally compatible with Semantic Kernel's filter model: before/after interception, exception capture, result override decisions, retries, and early termination all map naturally onto execution spans and metadata.

The current design direction is also aligned with OpenTelemetry and W3C Trace Context concepts even though this repo is not exporting OTel traces yet:

- workflow runs behave like trace roots
- executions behave like spans
- typed decision/artifact/failure/handoff records behave like domain events attached to a run or span
- `project`, `workItemId`, `planRunId`, `planStepId`, `agentName`, and `sessionId` provide correlation fields for parallel agent work across worktrees

## Audit Commands

- `npm run workflow:start implementation "<summary>"`
- `npm run workflow:note implementation "<note>"`
- `npm run workflow:retro -- <run-id>`
- `npm run execution:start -- --workflow implementation --kind skill --name workflow-audit`
- `npm run execution:end -- --workflow implementation --execution-id <id> --status success`
- `npm run audit:decision -- --workflow implementation --category tool-selection --summary "Use SSE for live audit streaming" --rationale "Server-to-client stream only" --selected-option sse`
- `npm run audit:artifact -- --workflow implementation --type pr --label "PR #11" --uri https://github.com/...`
- `npm run audit:failure -- --workflow implementation --category merge-conflict --summary "Conflict in AGENTS.md" --severity medium --retryable true`
- `npm run audit:handoff -- --workflow implementation --source-agent planner --target-agent implementer --summary "Implement PLAN-42 validation slice" --status pending`
- `npm run quality:changed -- <files...>`
- `npm run quality:logged -- implementation`
- `npm run workflow:end implementation success`

You can attach plan lineage directly at workflow start:

- `npm run workflow:start implementation -- --workflow implementation --task "Implement PLAN-42" --project audit --work-item-id PLAN-42 --plan-run-id <plan-run-id> --plan-step-id <plan-step-id>`

## Git Hook Integration

- `pre-commit` runs the staged-file guardrail script and records it as workflow `pre-commit`
- `pre-push` runs the full logged quality workflow as `pre-push`
- hooks invoke the repo-local `tools/runtime/run-npm.cjs` shim so they can use the pinned `.nvmrc` runtime without requiring `nvm use`
- both hooks use the same audited command wrappers as manual runs, so hook behavior stays visible and reproducible
- hook-level executions are recorded with `kind: "hook"` before nested command spans are emitted

## Audit Storage

- The shared audit database defaults to `C:\Users\<user>\.taxes\audit\sqlite\audit.db`
- All worktrees write into that one SQLite file, and each run stores `repoPath` plus `worktreePath`
- The current rollout is dual-write:
  - file artifacts still land under `artifacts/audit/`
  - the same events and summaries are mirrored into the shared database
- The local active-run registry at `artifacts/audit/active-runs.json` now uses a filesystem lock for updates and quarantines malformed snapshots into timestamped `active-runs.corrupt-*.json` artifacts before rebuilding a clean registry.
- The monitor stack lives under:
  - `apps/audit/api`
  - `apps/audit/web`

## Audit Artifacts

- Runs are still grouped by date under `artifacts/audit/YYYY-MM-DD/`
- Audit data is written to `artifacts/audit/`
- Retrospectives derived from audit runs are written to `artifacts/retrospectives/`
- Runs are grouped by date under `artifacts/audit/YYYY-MM-DD/`
- Each run gets its own folder with:
  - `events.ndjson`
  - `summary.json`
  - `logs/*.log`
- Retrospective outputs use `artifacts/retrospectives/YYYY-MM-DD/<runId>.md`

## Event Types

- `artifact-recorded`
- `decision-recorded`
- `workflow-start`
- `workflow-note`
- `execution-start`
- `execution-end`
- `failure-recorded`
- `handoff-recorded`
- `workflow-end`

## Execution Kinds

- `command`
- `hook`
- `operation`
- `skill`
- `tool`
- `validation`

## Summary Shape

- `steps` keeps command-level compatibility for quick scanning
- `executions` stores every finished span with duration, status, parent linkage, and metadata
- `stats` aggregates execution counts by kind and status so failures and hot paths are easy to spot
- `decisions` stores branch, tool, retry, and workaround choices with rationale
- `artifacts` stores outputs such as PRs, screenshots, reports, migrations, and docs
- `failures` stores classified problems such as merge conflicts, validation failures, timeouts, or dependency issues
- `handoffs` stores agent-to-agent transitions with source, target, status, and optional artifact linkage
- `failureInsights` enriches run detail with operator-facing failure analysis, including matched execution or event errors plus local log excerpts when they exist
- run context fields make it possible to group and filter by project, work item, plan run, plan step, agent, and session

## Work Item Timeline

- `GET /api/audit/work-items/:workItemId/timeline` returns the cross-run lineage for one work item
- the response groups runs, events, decisions, artifacts, failures, and handoffs for that work item
- the audit monitor now shows that lineage alongside selected run detail so multi-agent work is reviewable as one thread instead of disconnected runs

## Failure Investigation

- `GET /api/audit/runs/:runId` now returns `failureInsights` alongside the raw executions, events, and typed failures
- each insight is synthesized from the nearest `failure`, failed `execution`, and failed `event` records for the selected run
- when a failed execution points at a local `logs/*.log` artifact, the API includes a tail excerpt so operators can see the error cause without leaving the monitor
- the monitor uses that richer payload to answer "why did this fail?" before dropping users into the lower-level tables and event timeline

## Why This Shape

- deterministic and cross-platform
- readable by humans and machines
- works for Codex-style workflows without requiring proprietary hook support
- easy to attach to git hooks now and CI later
- supports evidence-backed retrospectives instead of relying on chat history alone
- supports explicit skill/tool instrumentation today and Semantic Kernel filter adapters later
- supports multi-agent reporting views across several concurrent worktrees sharing one audit database
- gives multiple local worktrees one live monitoring surface instead of fragmented folder-only logs
