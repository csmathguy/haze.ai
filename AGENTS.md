# Agent Engineering Rules

This file defines the mandatory workflow for humans and coding agents in this repository.

## Core engineering principles
- Prefer KISS over cleverness.
- Keep responsibilities focused (SOLID and clear boundaries).
- Remove duplication aggressively (DRY), but not at the cost of readability.
- Keep dependency direction explicit: UI -> API -> domain/service -> infrastructure.

## Required implementation workflow (TDD-first)
1. Define or refine acceptance criteria in `apps/backend/data/tasks/tasks.json` task records (`description`, `metadata.acceptanceCriteria`).
2. Write or update failing tests first.
3. Implement minimal code to make tests pass.
4. Refactor for design quality and maintainability.
5. Run full verification before marking complete.

## Required verification commands
Run these at repo root:
- `npm run lint`
- `npm run typecheck`
- `npm run check:circular`
- `npm run test:coverage`
- `npm run build`
- `npm run verify`

`npm run verify` is the release gate and must pass before merge.

## Code quality rules
- Use TypeScript strict mode and explicit domain types.
- Avoid hidden side effects; isolate I/O at boundaries.
- Use dependency injection for external services where practical.
- Prefer composition over inheritance.
- Keep modules small and cohesive.
- Add structured logs for operationally relevant state transitions.

## Testing rules
- Unit test all domain/service logic.
- Add integration tests for API behavior and persistence boundaries.
- Add frontend component tests for critical operator workflows.
- For bug fixes, add a regression test that fails before the fix.
- Minimum enforced coverage is 60% for lines/functions/branches/statements in each app.
- Team target is higher than the minimum; increase coverage when touching code.

## Agent collaboration rules
- Keep task decomposition in `apps/backend/data/tasks/tasks.json` using dependency links and tags.
- Keep discovery and open questions in task `metadata.discoveryQuestions` on the related task record.
- Move tasks through lifecycle statuses explicitly: `ready -> planning -> implementing -> review -> verification -> done`.
- Use `awaiting_human` whenever required user input blocks progress; include `metadata.awaitingHumanArtifact`.
- Attach stage artifacts during handoffs: `planningArtifact`, `reviewArtifact`, `verificationArtifact`, `doneArtifact`.
- Never implement on `main`; create a task branch first and record `metadata.workflow.branchName` + `metadata.workflow.baseBranch`.
- Each agent PR/change must include:
  - scope and assumptions,
  - tests added/updated,
  - verification results.
- Do not skip checks because of “small change” scope.
- For task completion, use `scripts/finish-task.ps1` as the canonical deterministic path for verify + commit + push + PR + task transition to `review`; do not perform ad-hoc manual PR flows.
- When a task's acceptance criteria are met and checks pass, run `scripts/finish-task.ps1` immediately; do not pause for confirmation unless the user explicitly asks to hold.

## Security and operations
- Never commit secrets.
- Validate required environment variables at process startup.
- Add retry/timeout/circuit-breaker behavior around external calls.
- Ensure every operator override action is auditable.

## Frontend implementation rules
- Use a centralized theme and design tokens; avoid ad-hoc colors/spacings in components.
- Keep light/dark mode system-aware with manual override.
- Follow accessibility baselines: semantic controls, visible focus states, and minimum contrast.
- Respect reduced-motion preferences for animated elements.
- Separate data access (`api.ts`) from rendering components to keep UI logic testable.
