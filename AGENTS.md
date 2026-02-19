# Agent Engineering Rules

This file defines the mandatory workflow for humans and coding agents in this repository.

## Core engineering principles
- Prefer KISS over cleverness.
- Keep responsibilities focused (SOLID and clear boundaries).
- Remove duplication aggressively (DRY), but not at the cost of readability.
- Keep dependency direction explicit: UI -> API -> domain/service -> infrastructure.

## Required implementation workflow (TDD-first)
1. Define or refine acceptance criteria in `apps/backend/data/tasks/tasks.json` task records (`description`, `metadata.acceptanceCriteria`).
2. Define planning-stage testing intent in `metadata.testingArtifacts.planned` (Gherkin scenarios + unit/integration intent).
3. Write or update failing tests first.
4. Implement minimal code to make tests pass.
5. Refactor for design quality and maintainability.
6. Run full verification before marking complete.

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

## Architecture guardrails
- Treat backend structure as layered/ports-and-adapters: `domain` (pure logic) -> `application/service` (use cases) -> `infrastructure/adapters` (I/O and providers).
- Enforce dependency inversion at boundaries: depend on interfaces/types, not concrete adapter implementations.
- For new modules, prefer one responsibility per file; split files that exceed ~300 logical lines or mix multiple concerns.
- Prefer explicit folder boundaries for growing features:
  - `apps/backend/src/domain/*`
  - `apps/backend/src/services/*`
  - `apps/backend/src/infrastructure/*`
  - `apps/backend/src/api/*`
- When introducing a pattern (Strategy, Adapter, Factory, etc.), add a brief comment at the abstraction point naming the pattern and the reason it is used.
- Document architecture-significant choices in `documentation/standards/*` and link them from related task artifacts.

## Architecture enforcement workflow (required)
- Before `scripts/finish-task.ps1`, run the `architecture-modularity-review` skill for backend/frontend code changes.
- Hard file-size budget for new/updated source files:
  - backend/frontend source default max: 400 logical lines (excluding comments/blank lines)
  - test files are exempt from this hard cap but still should be split when hard to navigate
- Legacy large-file carve-outs are temporary and must be reduced over time; do not add new carve-outs without a task + rationale.
- If a change would push a file above the hard cap, the agent must:
  - split code into focused modules first, or
  - open/attach a dedicated refactor task with explicit decomposition plan and keep feature change minimal.
- Any PR touching orchestration/task-engine logic must include:
  - changed responsibilities by file,
  - why boundaries are still cohesive,
  - what follow-up split tasks exist (if not fully refactored now).

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
- Attach testing traceability artifacts during handoffs:
  - planning: `metadata.testingArtifacts.planned`
  - review/verification: `metadata.testingArtifacts.implemented`
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

## Frontend architecture patterns
- Keep `App.tsx` as a thin composition shell only (view selection + shared layout chrome).
- Place each major surface in `src/components` as an isolated view module (`DashboardView`, `KanbanView`, `ProjectsView`).
- Move reusable parsing/normalization logic into focused helper modules next to the owning view (for example `kanbanView.helpers.ts`).
- Keep route/view state in dedicated hooks (`src/hooks`) so UI modules are easier to test and refactor independently.
