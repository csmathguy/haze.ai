# Modularity Refactor Playbook (2026-02-18)

## Purpose
Prevent oversized, mixed-responsibility files and enforce enterprise-grade modularity in the TypeScript backend/frontend codebase.

## Source-backed constraints
- Enforce maintainability budgets with ESLint `max-lines` for source files.
- Prefer composition over inheritance for UI/module reuse boundaries.
- Keep TypeScript strict typing and explicit contracts at service boundaries.
- Use layered agent instructions (`AGENTS.md`) and reusable skills to enforce workflow behavior consistently.

## Hard guardrails for this repo
- Source file hard cap: 400 logical lines (`.ts` / `.tsx`, excluding tests).
- Tests are exempt from hard cap, but long tests should still be split by feature/behavior.
- Existing carve-out files are temporary legacy debt and must not be treated as precedent.
- Any change that exceeds the hard cap must either:
  - refactor/split before merge, or
  - create a dedicated refactor task with explicit decomposition plan.

## Refactor decomposition pattern
When splitting a large file, split by responsibility in this order:
1. Contracts and shared types (`types.ts`).
2. Validation/policy logic (`policy.ts`).
3. Use-case orchestration (`service.ts` / stage service modules).
4. External adapters and side effects (`infrastructure/*`).
5. Composition root wiring (`index.ts`).

## Required PR notes for architecture-sensitive changes
- Responsibilities by changed file.
- Which boundaries were introduced or tightened.
- Any temporary carve-out touched and whether responsibility surface was reduced.
- Follow-up refactor task id if full split is deferred.

## Operational workflow updates
- Run architecture review skill before `finish-task`.
- Keep lint/typecheck/check:circular/test:coverage/build as mandatory gate.
- Reject manual bypass of `scripts/finish-task.ps1`.

## References
- ESLint `max-lines` rule:
  - https://eslint.org/docs/latest/rules/max-lines
- React guidance on composition:
  - https://legacy.reactjs.org/docs/composition-vs-inheritance.html
- TypeScript strict mode:
  - https://www.typescriptlang.org/tsconfig/#strict
- OpenAI Codex instruction layering (`AGENTS.md`) and skills:
  - https://developers.openai.com/codex/guides/agents-md
  - https://developers.openai.com/codex/skills
