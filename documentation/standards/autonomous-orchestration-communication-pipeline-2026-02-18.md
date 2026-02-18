# Autonomous Orchestration Communication Pipeline and Context Packaging (T-00109)

- Date: 2026-02-18
- Status: Draft
- Depends on:
  - `documentation/standards/autonomous-orchestration-role-contracts-2026-02-18.md`
  - `documentation/standards/autonomous-orchestration-action-engine-2026-02-18.md`
  - `documentation/standards/autonomous-orchestration-hook-trigger-model-2026-02-18.md`

## Purpose
Define a deterministic agent-to-agent communication model for stage handoffs with:
- consistent message envelopes
- bounded context payloads
- auditable correlation across workflow transitions

## Pipeline Topology (v1)
- Producer: workflow stage adapter (planner/architect/tester).
- Transport: persisted task metadata + workflow runtime action queue.
- Consumer: next stage adapter resolved by orchestrator action engine.

The pipeline is logical (metadata-backed), not a distributed message broker in v1.

## Canonical Message Envelope
Every handoff message should follow this shape:

```json
{
  "schemaVersion": "1.0",
  "messageId": "uuid",
  "taskId": "uuid",
  "canonicalTaskId": "T-00109",
  "fromStage": "planning",
  "toStage": "implementing",
  "createdAt": "2026-02-18T22:00:00Z",
  "correlation": {
    "runId": "run-...",
    "actionId": "action-...",
    "transitionId": "transition-..."
  },
  "artifacts": {
    "planningArtifactRef": "metadata.planningArtifact",
    "reviewArtifactRef": null,
    "verificationArtifactRef": null
  },
  "context": {
    "summary": ["..."],
    "constraints": ["..."],
    "openQuestions": ["..."]
  },
  "policy": {
    "riskClass": "low|medium|high",
    "safetyChecks": ["allowlist_passed"]
  }
}
```

## Handoff Rules
1. One transition, one envelope:
- A status transition can emit at most one canonical handoff envelope per action id.
2. Idempotent publication:
- Duplicate attempts with same transition/action id must overwrite or no-op, never append duplicate semantic payloads.
3. Artifact references over raw duplication:
- Use artifact refs where possible instead of embedding full artifact bodies.
4. Explicit stage ownership:
- Producer can only set fields owned by its stage contract.

## Context Packaging Strategy
## Required context fields
- stage summary (short bullets)
- acceptance criteria snapshot
- dependency status summary
- active risks + blockers

## Optional context fields
- prior-stage diagnostics
- policy exceptions under review
- operator notes

## Compaction and limits
- Prefer references + concise summaries over full transcripts.
- Redact or omit sensitive values not required for next stage.
- Keep payload bounded; large content should be linked by reference.

## Integrity and Replayability
- Envelope identity:
  - `messageId` unique per publish
  - `correlation.transitionId` stable per status transition
- Replay rule:
  - Replaying same transition/action should rehydrate same effective context and not produce duplicate side effects.
- Validation:
  - Reject envelopes missing required correlation or stage fields.

## Safety and Guardrail Integration
- Envelope publication occurs only after hook/safety checks pass.
- Denied/escalated actions must publish a minimal escalation envelope with:
  - blocking reason code
  - recommended human action
  - awaiting-human artifact reference

## Observability Requirements
For each envelope publish/consume event record:
- task id + canonical id
- from/to stage
- message id + correlation ids
- publish/consume timestamp
- validation outcome

Persist linkages in `workflowRuntime.actionHistory` and audit sink for traceability.

## Acceptance Criteria Mapping
1. Agent communication pipeline defined:
- Covered by topology and handoff rules.
2. Context packaging strategy defined:
- Covered by canonical envelope and context packaging strategy.
3. Determinism/auditability preserved:
- Covered by integrity/replayability and observability requirements.

## Follow-up Implementation Notes
- `T-00111`: use correlation requirements for observability schema.
- `T-00113`: checkpoint/resume should key off transition/action correlation ids.
- `T-00116`: keep provider-specific invocation payloads outside canonical inter-stage envelope.
