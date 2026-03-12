# Agent Observability

## Goal

Make agent work reviewable without relying on hidden state or chat history alone.

## Approach

This repository uses script-based audit logging rather than product-native hooks. The current OpenAI and Codex material reviewed for this repository documents `AGENTS.md` support and repository instructions, but I did not find a documented repo-local hook system comparable to Claude Code hooks. That is an inference from the sources listed in `research-sources.md`.

## Audit Commands

- `npm run workflow:start implementation "<summary>"`
- `npm run workflow:note implementation "<note>"`
- `npm run workflow:retro -- <run-id>`
- `npm run quality:changed -- <files...>`
- `npm run quality:logged -- implementation`
- `npm run workflow:end implementation success`

## Git Hook Integration

- `pre-commit` runs the staged-file guardrail script and records it as workflow `pre-commit`
- `pre-push` runs the full logged quality workflow as `pre-push`
- hooks invoke the repo-local `tools/runtime/run-npm.cjs` shim so they can use the pinned `.nvmrc` runtime without requiring `nvm use`
- both hooks use the same audited command wrappers as manual runs, so hook behavior stays visible and reproducible

## Audit Artifacts

- Audit data is written to `artifacts/audit/`
- Retrospectives derived from audit runs are written to `artifacts/retrospectives/`
- Runs are grouped by date under `artifacts/audit/YYYY-MM-DD/`
- Each run gets its own folder with:
  - `events.ndjson`
  - `summary.json`
  - `logs/*.log`
- Retrospective outputs use `artifacts/retrospectives/YYYY-MM-DD/<runId>.md`

## Event Types

- `workflow-start`
- `workflow-note`
- `command-start`
- `command-end`
- `workflow-end`

## Why This Shape

- deterministic and cross-platform
- readable by humans and machines
- works for Codex-style workflows without requiring proprietary hook support
- easy to attach to git hooks now and CI later
- supports evidence-backed retrospectives instead of relying on chat history alone
