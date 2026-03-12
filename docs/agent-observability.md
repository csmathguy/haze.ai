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

That shape is intentionally compatible with Semantic Kernel's filter model: before/after interception, exception capture, result override decisions, retries, and early termination all map naturally onto execution spans and metadata.

## Audit Commands

- `npm run workflow:start implementation "<summary>"`
- `npm run workflow:note implementation "<note>"`
- `npm run execution:start -- --workflow implementation --kind skill --name workflow-audit`
- `npm run execution:end -- --workflow implementation --execution-id <id> --status success`
- `npm run quality:changed -- <files...>`
- `npm run quality:logged -- implementation`
- `npm run workflow:end implementation success`

## Git Hook Integration

- `pre-commit` runs the staged-file guardrail script and records it as workflow `pre-commit`
- `pre-push` runs the full logged quality workflow as `pre-push`
- hooks invoke the repo-local `tools/runtime/run-npm.cjs` shim so they can use the pinned `.nvmrc` runtime without requiring `nvm use`
- both hooks use the same audited command wrappers as manual runs, so hook behavior stays visible and reproducible
- hook-level executions are recorded with `kind: "hook"` before nested command spans are emitted

## Audit Artifacts

- Audit data is written to `artifacts/audit/`
- Runs are grouped by date under `artifacts/audit/YYYY-MM-DD/`
- Each run gets its own folder with:
  - `events.ndjson`
  - `summary.json`
  - `logs/*.log`

## Event Types

- `workflow-start`
- `workflow-note`
- `execution-start`
- `execution-end`
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

## Why This Shape

- deterministic and cross-platform
- readable by humans and machines
- works for Codex-style workflows without requiring proprietary hook support
- easy to attach to git hooks now and CI later
- supports explicit skill/tool instrumentation today and Semantic Kernel filter adapters later
