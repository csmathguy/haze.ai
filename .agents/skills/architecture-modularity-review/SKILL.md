---
name: architecture-modularity-review
description: Run an architecture quality checkpoint for TypeScript changes before finish-task. Use when a task introduces new modules, large files, provider abstractions, policy logic, or cross-layer dependencies and needs SOLID/modularity validation.
---

# Architecture Modularity Review

## Inputs
- changed file list
- target task id
- architecture-sensitive areas (providers, policies, orchestrators, stores)

## Procedure
1. Read `documentation/standards/enterprise-typescript-architecture-guardrails-2026-02-18.md`.
2. Run a line-budget scan for changed source files.
   - Default hard cap: 400 logical lines for source files (`.ts`, `.tsx`), excluding tests.
   - Existing temporary carve-outs must be treated as refactor debt, not a model for new files.
2. Inspect changed files for:
- single responsibility per file/module
- inward dependency direction (API -> service -> domain, infra at boundaries)
- provider and external I/O isolated behind interfaces/adapters
- policy checks centralized (not duplicated across call sites)
3. Flag files that exceed limits and propose specific split points:
   - types/contracts
   - policy/validation
   - orchestration/use-case logic
   - adapters/external I/O
4. Verify at least one test covers each new/changed domain or service boundary.
5. If limits are exceeded, require one of:
   - immediate refactor before finish-task, or
   - explicit follow-up refactor task with scope and due priority.
6. Add architecture notes to task metadata `transitionNote` or review artifact summary before `finish-task`.

## Output
- pass/fail architecture checkpoint
- concrete findings with file references
- required refactors (if any) before review
