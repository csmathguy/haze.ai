# Autonomous Tester Agent Workflow and Evidence Planning (T-00104)

- Date: 2026-02-18
- Status: Draft
- Depends on:
  - `documentation/standards/autonomous-orchestration-role-contracts-2026-02-18.md`
  - `documentation/standards/engineering-workflow.md`
  - `documentation/standards/autonomous-orchestration-architect-review-workflow-2026-02-18.md`

## Purpose
Define tester-agent stage behavior that transforms planning and architect outputs into:
- actionable test strategy
- concrete evidence expectations
- deterministic verification-readiness outcomes

## Inputs
- `planningArtifact`
- `testingArtifacts.planned` (existing baseline)
- `reviewArtifact` from architect-review stage
- acceptance criteria and risk context

## Outputs
- required:
  - refined `testingArtifacts.planned` with executable scope
  - `verificationArtifact` readiness plan
- optional:
  - remediation findings for missing/weak test intent
  - `awaitingHumanArtifact` if required test environment choices are unresolved

## Tester Decision Model
## Decisions
- `ready_for_implementation_tests`:
  - planned tests cover acceptance criteria and major risks
  - command strategy and evidence collection are defined
- `needs_test_plan_remediation`:
  - missing scenario coverage or unclear evidence expectations
- `blocked_needs_human_test_decision`:
  - unresolved environment/tool constraints requiring operator choice

## Coverage expectations
For each acceptance criterion:
1. at least one Gherkin scenario
2. mapped unit or integration intent
3. expected evidence signal (test file + command + outcome artifact)

## Evidence Planning Schema (v1)
```json
{
  "verificationArtifact": {
    "planStatus": "ready_for_implementation_tests|needs_test_plan_remediation|blocked_needs_human_test_decision",
    "commands": ["npm run test --workspace @haze/backend"],
    "requiredEvidence": [
      {
        "criterionRef": "AC-1",
        "testIntentRef": "testingArtifacts.planned.unitTestIntent[0]",
        "evidenceType": "test_result|coverage|build",
        "collectionMethod": "command_output|ci_link"
      }
    ],
    "notes": ["..."]
  }
}
```

## Remediation Loop
- if decision is `needs_test_plan_remediation`:
  - tester emits remediation guidance with missing criterion-to-test mappings
  - task returns to `implementing` with explicit required additions
- on rerun:
  - unresolved findings must remain open with stable IDs
  - resolved findings marked closed with rationale

## Guardrails
- tester stage must not bypass architect critical findings
- evidence expectations must align with repository verification commands
- test plan cannot be marked ready if any acceptance criterion lacks mapped evidence

## Acceptance Criteria Mapping
1. tester stage behavior defined:
- covered by decision model and stage IO.
2. evidence planning strategy defined:
- covered by evidence schema and coverage expectations.
3. remediation loop documented:
- covered by remediation loop and guardrails.

## Follow-up Implementation
- `T-00119`: implement tester-stage adapter with readiness/remediation decisions.
- `T-00106`: consume tester evidence model in review-agent quality checks.
