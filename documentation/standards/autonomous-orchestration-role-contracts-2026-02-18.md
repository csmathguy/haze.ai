# Autonomous Orchestration Role Contracts and Handoff Schema (T-00099)

- Date: 2026-02-18
- Status: Accepted
- Depends on: `documentation/standards/autonomous-orchestration-adr-2026-02-18.md`

## Purpose
Define deterministic, auditable role boundaries and task metadata handoff artifacts for autonomous orchestration.

## Role Contracts
### Planner (v1 active)
- Responsibility: turn task intent into an execution plan and test intent.
- Required input:
  - Task core fields (`title`, `description`, `acceptanceCriteria`, `dependencies`)
  - ADR/runtime policy constraints
- Required output:
  - `metadata.planningArtifact`
  - `metadata.testingArtifacts.planned`
- Optional output:
  - `metadata.awaitingHumanArtifact` when clarification is required
- Must not mutate:
  - `metadata.reviewArtifact`
  - `metadata.verificationArtifact`
  - `metadata.doneArtifact`

### Architect (v1 active)
- Responsibility: evaluate plan against architecture/policy constraints.
- Required input:
  - `metadata.planningArtifact`
  - `metadata.testingArtifacts.planned`
  - ADR/runtime policy constraints
- Required output:
  - `metadata.reviewArtifact` (findings, decision, remediation items)
- Optional output:
  - `metadata.awaitingHumanArtifact` for policy exception decisions
- Must not mutate:
  - Planner outputs except appending review references

### Tester (v1 active)
- Responsibility: validate test strategy and execution evidence quality.
- Required input:
  - `metadata.testingArtifacts.planned`
  - `metadata.reviewArtifact`
- Required output:
  - `metadata.verificationArtifact`
  - `metadata.testingArtifacts.implemented` (when tests are added/updated)
- Must not mutate:
  - `metadata.planningArtifact.goals/steps/risks`

### Developer (phase 2)
- Responsibility: implement task changes via TDD and update test evidence.
- Required output:
  - code changes + `metadata.testingArtifacts.implemented`

### Reviewer (phase 2)
- Responsibility: summarize change impact and policy compliance before merge.
- Required output:
  - enriched `metadata.reviewArtifact`

### Retrospective (phase 2)
- Responsibility: emit completion learnings and follow-up actions.
- Required output:
  - `metadata.doneArtifact` and/or `metadata.retrospectives[]`

## Canonical Handoff Metadata Schema
This schema is versioned through `metadata.schemaVersion` (recommended) and artifact-level schema keys where applicable.

```json
{
  "metadata": {
    "canonicalTaskId": "T-00123",
    "workflow": {
      "owner": "codex",
      "baseBranch": "main",
      "branchName": "task/t-00123-example",
      "pullRequestUrl": "https://github.com/org/repo/pull/123"
    },
    "planningArtifact": {
      "createdAt": "2026-02-18T20:00:00Z",
      "goals": ["..."],
      "steps": ["..."],
      "risks": ["..."]
    },
    "testingArtifacts": {
      "schemaVersion": "1.0",
      "planned": {
        "gherkinScenarios": ["Given ... When ... Then ..."],
        "unitTestIntent": ["..."],
        "integrationTestIntent": ["..."],
        "notes": null
      },
      "implemented": {
        "testsAddedOrUpdated": ["apps/backend/test/example.test.ts"],
        "evidenceLinks": ["https://github.com/org/repo/actions/runs/123"],
        "commandsRun": ["npm run verify"],
        "notes": null
      }
    },
    "reviewArtifact": {
      "changeSummary": ["..."],
      "filesTouched": ["..."],
      "knownRisks": ["..."],
      "decision": "approved|changes_requested"
    },
    "verificationArtifact": {
      "commands": ["npm run verify"],
      "result": "passed|failed",
      "notes": ["..."]
    },
    "awaitingHumanArtifact": {
      "question": "...",
      "options": [
        { "label": "Option A", "description": "..." },
        { "label": "Option B", "description": "..." }
      ],
      "recommendedOption": "Option A",
      "requestedAt": "2026-02-18T20:00:00Z"
    },
    "doneArtifact": {
      "completedAt": "2026-02-18T20:30:00Z",
      "summary": ["..."],
      "verification": ["npm run verify"]
    }
  }
}
```

## Mutability Rules
- Immutable after creation:
  - `planningArtifact.createdAt`
  - `workflow.branchName`
  - `workflow.baseBranch`
- Append-only:
  - `reviewArtifact.changeSummary`
  - `verificationArtifact.notes`
  - `testingArtifacts.implemented.commandsRun`
- Editable with reason note:
  - `planningArtifact.goals/steps/risks`
  - `testingArtifacts.planned.*`
  - Requirement: update `metadata.transitionNote` with change reason.

## Partial/In-Progress Representation
- Every stage artifact may include:
  - `status`: `draft | complete | superseded`
  - `updatedAt`: ISO timestamp
  - `updatedBy`: actor id
- Transition gates treat missing required fields as blocking.
- `draft` artifacts are valid in active stages but invalid for terminal transitions (`review`, `verification`, `done`) when required fields are incomplete.

## Validation Strategy
1. Shape validation:
   - Enforce object/array/string forms at write time in backend task service.
   - Reject invalid transitions with explicit `WorkflowBlockingReason` entries.
2. Stage-gate validation:
   - `implementing -> review`: require both `reviewArtifact` and `verificationArtifact`.
   - `* -> awaiting_human`: require `awaitingHumanArtifact`.
3. Backward compatibility:
   - Accept missing optional fields and normalize defaults.
   - Track schema via `testingArtifacts.schemaVersion` and future `metadata.schemaVersion`.
4. Auditability:
   - Record transition failures and redirects in `metadata.workflowRuntime.actionHistory`.

## Implementation Notes for Follow-up Tasks
- `T-00100`: use this document to define engine state transitions and idempotency keys.
- `T-00110`: map validation errors to safety escalation and operator prompts.
- `T-00116`: keep provider runtime details out of artifact schema to preserve runtime/provider swapability.
