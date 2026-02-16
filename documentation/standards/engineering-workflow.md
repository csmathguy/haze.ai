# Engineering Workflow Standards

Last updated: 2026-02-16

## Purpose
Codify an implementation workflow that keeps coding-agent output verifiable, maintainable, and production-safe.

## Workflow gates
1. Requirements gate: task and acceptance criteria documented.
2. Test gate: failing tests demonstrate expected behavior.
3. Implementation gate: minimal fix to satisfy tests.
4. Quality gate: lint/typecheck/tests/build all passing.
5. Review gate: risk notes and regression checks captured.

## Verification matrix
- Static checks: ESLint + TypeScript no-emit.
- Unit tests: domain logic and service behavior.
- Integration tests: API and infrastructure boundaries.
- Build checks: production compile for backend/frontend.
- CI: same local verify command executed in GitHub Actions.

## Design guardrails
- Single responsibility per module/service.
- Explicit interfaces for core orchestration abstractions.
- External API clients behind adapters for isolation and testability.
- Prefer deterministic behavior for scheduling/heartbeat logic.

## Agent task hygiene
- Keep tasks small and independently verifiable.
- Record assumptions and unresolved decisions in docs.
- Prefer incremental delivery with passing verification at each step.
