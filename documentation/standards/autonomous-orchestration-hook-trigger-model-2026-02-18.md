# Autonomous Orchestration Hook Trigger Model and Guardrails (T-00101)

- Date: 2026-02-18
- Status: Draft
- Depends on:
  - `documentation/standards/autonomous-orchestration-action-engine-2026-02-18.md`
  - `documentation/standards/autonomous-orchestration-safety-policy-2026-02-18.md`

## Purpose
Define workflow lifecycle hook behavior that drives orchestrator actions while preventing:
- duplicate trigger loops
- recursive status storms
- unsafe rollback behavior

## Hook Execution Model
## Hook phases
- `onExit(fromStatus)`
- `onEnter(toStatus)`

Execution order per transition:
1. Validate transition preconditions.
2. Execute `onExit(fromStatus)` hooks.
3. Persist transition state.
4. Execute `onEnter(toStatus)` hooks.
5. Persist nextActions/blockingReasons/actionHistory.

## Trigger mode
- Edge-triggered by status transition event (`from -> to`), not by passive status polling.
- Re-patching the same status without transition should not re-fire edge hooks.

## Trigger Matrix (v1)
- `backlog -> planning`
  - `onEnter(planning)`: enqueue planning preparation action
- `planning -> implementing`
  - `onExit(planning)`: assert planning artifacts complete
  - `onEnter(implementing)`: enqueue stage execution bootstrap
- `implementing -> review`
  - `onExit(implementing)`: verify review + verification artifacts
  - missing artifacts: redirect to `awaiting_human`
- `review -> verification`
  - `onExit(review)`: ensure review decision and remediation outcomes recorded
  - `onEnter(verification)`: enqueue verification check action
- `verification -> done`
  - `onExit(verification)`: ensure verification evidence exists
  - `onEnter(done)`: emit completion handoff action

## Debounce and Loop Guardrails
## Debounce rules
- Ignore repeated identical transition events for same task within a short debounce window.
- Ignore no-op patches (`status` unchanged).

## Loop prevention rules
- Maintain recent transition fingerprints in `workflowRuntime`:
  - fingerprint: `taskId + from + to + actionType + timestampBucket`
- If identical fingerprint appears above threshold in window:
  - block further dispatch
  - append blocking reason `TRIGGER_LOOP_DETECTED`
  - escalate to `awaiting_human`

## Recursion guard
- Hook execution must not directly patch status in a way that re-invokes the same hook chain synchronously.
- Any status patch requested by a hook must be queued as a deferred action.

## Rollback and Compensation Model
## Rollback scope
- Do not roll back immutable history artifacts.
- Roll back only transient orchestration state (queued actions, in-flight markers, temporary flags).

## Compensation actions
- If `onEnter` fails after transition persisted:
  - create compensation nextAction
  - append blocking reason
  - optionally transition to `awaiting_human` based on risk class

## Failure classes
- transient: retry with bounded backoff
- deterministic: block and escalate
- fatal: halt task automation and escalate immediately

## Safety Integration
- Every hook-triggered action must pass safety policy pre-check before dispatch.
- Policy denials produce:
  - `workflowRuntime.blockingReasons` entry
  - `awaitingHumanArtifact` with recommended option

## Observability and Audit Requirements
- For each hook invocation:
  - phase (`onEnter`/`onExit`)
  - status context (`from`, `to`)
  - action id/type
  - result (`ok`/`error`)
  - blocking reason count
- Persist entries in `workflowRuntime.actionHistory`.
- Emit audit event for blocked, redirected, and compensated executions.

## Acceptance Criteria Mapping
1. Hook-to-action mapping exists for lifecycle stages:
- Covered by Trigger Matrix and Hook Execution Model.
2. Guardrails prevent recursive/duplicate loops:
- Covered by Debounce and Loop Guardrails.
3. Rollback/compensation behavior is documented:
- Covered by Rollback and Compensation Model.

## Follow-up Implementation Notes
- `T-00109`: adopt fingerprint and deferred-action patterns in communication/context packaging.
- `T-00116`: ensure hook-dispatched calls are provider-agnostic and policy-filtered.
