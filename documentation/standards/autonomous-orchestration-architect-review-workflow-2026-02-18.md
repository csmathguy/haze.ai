# Autonomous Architect-Review Agent Workflow (T-00103)

- Date: 2026-02-18
- Status: Draft
- Depends on:
  - `documentation/standards/autonomous-orchestration-role-contracts-2026-02-18.md`
  - `documentation/standards/autonomous-orchestration-hook-trigger-model-2026-02-18.md`
  - `documentation/standards/autonomous-orchestration-safety-policy-2026-02-18.md`
  - `documentation/standards/enterprise-typescript-architecture-guardrails-2026-02-18.md`

## Purpose
Define architect-review stage behavior that evaluates planning artifacts against architecture and safety policies and emits deterministic outcomes:
- `approved`
- `changes_requested`
- `blocked_needs_human_decision`

## Stage Inputs
- `planningArtifact`
- `testingArtifacts.planned`
- planner clarification context (if present)
- architecture guardrails and policy baselines

## Stage Outputs
- required:
  - `reviewArtifact` with findings, severity, and decision
- optional:
  - `awaitingHumanArtifact` when policy exception or risk acceptance is required

## Review Decision Model
## Severity levels
- `critical`: violates non-negotiable guardrail (security/safety/architecture boundary)
- `major`: high design risk or missing required decomposition/test strategy
- `minor`: improvement opportunity; does not block progression

## Decision rules
1. `approved`:
- no critical findings
- no unresolved major findings
2. `changes_requested`:
- one or more unresolved major findings
3. `blocked_needs_human_decision`:
- policy exception required, conflicting architectural directives, or explicit risk acceptance needed

## Review Artifact Schema (v1)
```json
{
  "decision": "approved|changes_requested|blocked_needs_human_decision",
  "createdAt": "ISO-8601",
  "findings": [
    {
      "id": "F-001",
      "severity": "critical|major|minor",
      "category": "architecture|safety|testing|workflow",
      "summary": "Short finding statement",
      "evidenceRefs": ["metadata.planningArtifact.steps[1]"],
      "requiredRemediation": "Actionable change",
      "status": "open|resolved"
    }
  ],
  "summary": ["..."],
  "nextActions": ["..."]
}
```

## Remediation Loop
- if decision is `changes_requested`:
  - task transitions back to `implementing` with open findings
  - remediation instructions must be concrete and mapped to finding ids
- after remediation:
  - architect-review reruns and marks findings resolved/open deterministically

## Human Decision Path
- if decision is `blocked_needs_human_decision`:
  - attach `awaitingHumanArtifact` with:
    - risk statement
    - options with recommended default
    - consequence notes
  - transition to `awaiting_human`

## Guardrails
- architect-review must not mutate planner goal ownership fields except adding review references
- findings require category + severity + required remediation to be valid
- critical findings cannot be auto-waived by agent-only logic

## Acceptance Criteria Mapping
1. Architect stage emits structured review artifact:
- covered by output schema and decision model.
2. Reject path routes to remediation with actionable guidance:
- covered by remediation loop rules.
3. Approve path unlocks tester stage:
- covered by decision rules and progression semantics.

## Follow-up Implementation
- `T-00118`: implement architect-stage adapter and deterministic decision evaluator.
- `T-00104`: align tester preconditions with architect `approved` output contract.
