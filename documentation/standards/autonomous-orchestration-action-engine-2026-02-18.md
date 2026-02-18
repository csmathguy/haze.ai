# Autonomous Orchestrator Action Engine and Queue Semantics (T-00100)

- Date: 2026-02-18
- Status: Draft
- Depends on:
  - `documentation/standards/autonomous-orchestration-adr-2026-02-18.md`
  - `documentation/standards/autonomous-orchestration-role-contracts-2026-02-18.md`

## Goal
Define deterministic v1 action-engine behavior for autonomous orchestration with:
- single-task serial execution
- strict status-driven stage sequencing
- explicit retry/idempotency rules
- auditable transition and action traces

## Scope
In scope (v1):
- In-process backend worker loop
- One active task lease at a time
- Stage action dispatch based on task status and required artifacts
- Bounded retries for transient failures
- Idempotency keys for safe replay

Out of scope (v1):
- Parallel multi-task execution
- Distributed queue brokers
- Cross-process lease arbitration

## Engine Model
### Queue source
- Source of truth remains task records in backend storage.
- Eligible task filter:
  - status in active statuses (`planning`, `implementing`, `review`, `verification`)
  - no unresolved hard blocking reasons
  - dependencies satisfied for status advancement

### Processing mode
- Poll loop with deterministic ordering:
  1. priority ascending (1 highest)
  2. createdAt ascending
  3. id ascending
- Lease model (single process): in-memory active lease plus persisted `workflowRuntime.nextActions`.
- Only one task may be leased at a time in v1.

### Action dispatch
Each loop tick:
1. Select next eligible task.
2. Acquire lease (mark runtime state with action token).
3. Resolve next action from status + artifact completeness.
4. Dispatch stage adapter action (`planner`, `architect`, `tester` in v1 autonomy scope).
5. Persist action result, transition note, and runtime action history.
6. Release lease.

## State and Transition Semantics
### Runtime states
- `idle`: no leased task
- `leased`: task selected for action execution
- `dispatching`: adapter invocation in flight
- `persisting`: writing artifacts/status updates
- `backoff`: transient failure cooldown
- `blocked`: task moved/kept in `awaiting_human` or blocked by policy

### Status-aware action matrix
- `planning`:
  - Action: planner generate/update planning artifacts
  - Success path: keep `planning` until human plan approval, then transition to `implementing`
  - Block path: set `awaitingHumanArtifact`, move to `awaiting_human`
- `implementing`:
  - Action: role-specific execution (v1 mainly policy/test handoff prep around planner/architect/tester scope)
  - Success path: emit required artifacts for `review` transition
  - Block path: redirect to `awaiting_human` if required artifacts or approvals are missing
- `review`:
  - Action: architect/review policy checks and remediation decision
  - Success path: transition to `verification`
- `verification`:
  - Action: tester verification evidence checks
  - Success path: transition to `done` gate readiness (human merge gate remains)

## Retry and Backoff Policy
### Error classes
- `transient`: provider timeout, rate limiting, temporary IO
- `deterministic`: schema validation failure, policy rejection, invalid transition
- `fatal`: unrecoverable configuration/runtime faults

### Retry rules
- Transient errors:
  - max attempts per action: 3
  - backoff: 5s, 15s, 30s
- Deterministic/fatal errors:
  - no auto-retry
  - record blocking reason and escalate

### Escalation path
- After retry exhaustion, append blocking reason and transition to `awaiting_human` with actionable options.

## Idempotency Strategy
### Idempotency key
`taskId + status + actionType + artifactHash + attemptWindow`

### Guarantees
- Repeated dispatch with same idempotency key must not duplicate artifact append operations.
- Stage adapters should upsert deterministic artifact fields and append only explicitly append-only fields.
- Transition write path must check existing `workflowRuntime.actionHistory` for matching key before mutating.

## Persistence and Audit Requirements
- Persist after every significant step:
  - lease acquired
  - action dispatched
  - action completed/failed
  - retry scheduled
  - transition applied or blocked
- Required trace linkage:
  - task id
  - canonical task id
  - run/action id
  - status from/to
  - idempotency key

## Pseudocode (v1 loop)
```text
while worker_enabled:
  task = select_next_eligible_task()
  if task == none:
    sleep(poll_interval)
    continue

  lease = acquire_single_task_lease(task)
  if lease.failed:
    continue

  action = resolve_next_action(task)
  result = dispatch(action, task)

  if result.success:
    persist_success(task, action, result)
  else:
    classify_error(result.error)
    if transient and attempts < max:
      schedule_retry(task, action)
    else:
      persist_blocking_reason(task, result.error)
      maybe_transition_to_awaiting_human(task)

  release_lease(task)
```

## Acceptance Criteria Mapping
1. Queue semantics and state transitions are defined for each stage:
- Covered by Engine Model, State and Transition Semantics, and pseudocode.
2. Concurrency and retry behavior are explicitly documented:
- Covered by Processing mode and Retry and Backoff Policy.
3. Idempotency strategy exists for repeated triggers:
- Covered by Idempotency Strategy.

## Follow-up Implementation Tasks
- `T-00101`: bind workflow hooks to `resolve_next_action` and dispatch triggers.
- `T-00109`: formalize context packaging and action payload envelopes.
- `T-00111`: add observability fields for per-action and per-stage metrics.
- `T-00113`: define checkpoint/resume details on top of idempotency keys.
