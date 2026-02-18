# ADR: Autonomous Orchestrator Runtime and Model/Tool Stack (T-00098)

- Date: 2026-02-18
- Status: Accepted
- Owners: Platform/Workflow automation
- Related: `T-00097`, `T-00098`, `T-00099`, `T-00100`, `T-00110`, `T-00116`

## Context
The repository is introducing autonomous task orchestration with staged agent handoffs. We need a runtime decision that is fast to ship now, but does not lock the system away from an API-native, multi-provider future.

Constraints:
- Existing workflow is script-first and backend-driven.
- Early phases need tight safety controls, deterministic transitions, and auditable events.
- Human-in-the-loop (HITL) gates must remain explicit for planning clarification and pre-merge review.

## Decision
Adopt a phased runtime strategy:

1. Phase 1 runtime: Codex CLI wrapper executed by an in-process backend worker.
2. Invocation architecture: stable provider abstraction used by orchestrator stages.
3. Safety baseline: strict allowlist for commands/tools with explicit escalation for risky actions.
4. Concurrency baseline: single-task serial processing in v1.
5. HITL baseline: planning clarification and pre-merge review only in v1.

This is the authoritative runtime decision for the orchestration roadmap started on 2026-02-18.

## Decision Details
### Runtime topology
- The orchestrator remains in the backend process and dispatches stage actions through a worker loop.
- Worker invocations call a `RuntimeProvider` interface, not direct CLI/API code from workflow logic.

### Provider abstraction contract
All runtime/model/provider integrations must implement the same contract:
- `startRun(input, policy) -> runHandle`
- `streamEvents(runHandle) -> normalized event stream`
- `resumeRun(runHandle, input?) -> runHandle`
- `cancelRun(runHandle) -> result`
- `collectArtifacts(runHandle) -> normalized artifacts + metrics + audit IDs`

Contract requirements:
- Runtime-agnostic event schema for stage transitions and audit linkage.
- Central policy injection for tool allowlist, model constraints, and timeout/retry settings.
- Provider-specific errors mapped into shared orchestration error classes.

### Operational model
Local development:
- Run backend worker in-process with Codex CLI wrapper.
- Use low-privilege defaults and repo-scoped policies for tool execution.

CI:
- Run orchestrator integration tests with deterministic fixtures and mocked/recorded provider events where possible.
- Keep safety policy strict; no broad command expansion in CI.

Production:
- Continue provider abstraction boundary.
- Keep CLI provider available as fallback while API-native provider matures.
- Emit correlated run/stage/task audit identifiers for operations and incident review.

## Alternatives Considered
1. Codex CLI-first worker orchestration (selected for phase 1)
- Accepted because it minimizes time-to-first-autonomy and aligns with current script-heavy workflows.
- Rejected as sole long-term architecture due to process orchestration complexity and weaker native async/tooling model.

2. Codex SDK-first orchestration in backend worker
- Rejected for phase 1 due to higher near-term integration cost than CLI wrapper.
- Remains a valid migration candidate behind the same provider contract.

3. OpenAI API-native orchestration first (Responses + tools + optional Agents SDK)
- Rejected for phase 1 due to higher up-front architecture cost.
- Accepted as long-term target once contracts, safety, and observability baselines are proven.

## Fallback Path
If CLI runtime is unstable or unsafe in production-like runs:
1. Freeze new CLI-powered autonomy expansion.
2. Keep orchestrator stage contract unchanged.
3. Switch runtime provider implementation behind `RuntimeProvider` to API-native path for prioritized stages.
4. Re-run reliability and policy validation suite before broad re-enable.

## Consequences
Positive:
- Fast path to validate autonomous orchestration flow and HITL boundaries.
- Clear contract for future API-native and multi-provider migration.
- Centralized policy control improves safety consistency.

Tradeoffs:
- Additional adapter layer and normalization work in phase 1.
- Temporary dual-mode support cost during migration window.

## Acceptance Criteria Traceability
- Selected stack + alternatives + rejection reasons: covered in Decision and Alternatives sections.
- Local/CI/production model: covered in Operational model.
- Fallback path: covered in Fallback Path.
- Modular provider abstraction for CLI/API and multi-provider plug-and-play: covered in Provider abstraction contract.
