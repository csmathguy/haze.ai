# Autonomous Planner Agent and Questionnaire Workflow (T-00102)

- Date: 2026-02-18
- Status: Draft
- Depends on:
  - `documentation/standards/autonomous-orchestration-role-contracts-2026-02-18.md`
  - `documentation/standards/autonomous-orchestration-hook-trigger-model-2026-02-18.md`
  - `documentation/standards/autonomous-orchestration-safety-policy-2026-02-18.md`

## Purpose
Define deterministic planner-stage behavior for:
- generating planning artifacts
- generating questionnaire prompts when clarification is required
- resuming planning after human answers

## Planner Inputs
- task core fields: title, description, acceptance criteria, dependencies
- prior artifacts: `planningArtifact`, `testingArtifacts.planned`, `awaitingHumanArtifact` (if resuming)
- architecture and safety constraints from standards docs

## Planner Outputs
- required:
  - `metadata.planningArtifact` (goals, steps, risks)
  - `metadata.testingArtifacts.planned` (gherkin/unit/integration intent)
- optional:
  - `metadata.awaitingHumanArtifact` (questionnaire payload)

## Clarification Decision Logic
Planner must require questionnaire when any of these are true:
1. acceptance criteria ambiguity:
- two or more materially different implementation paths
2. missing hard requirement inputs:
- environment/config/provider requirements absent
3. high-risk safety/policy uncertainty:
- action path may violate guardrails without explicit operator preference

If no condition is met, planner proceeds without questionnaire.

## Questionnaire Schema (v1)
```json
{
  "question": "single-sentence clarification request",
  "options": [
    { "label": "Choice A (Recommended)", "description": "impact/tradeoff" },
    { "label": "Choice B", "description": "impact/tradeoff" }
  ],
  "recommendedOption": "Choice A (Recommended)",
  "requestedAt": "ISO-8601",
  "context": {
    "reasonCodes": ["AC_AMBIGUOUS", "MISSING_INPUT"],
    "affectedSections": ["planningArtifact.steps", "testingArtifacts.planned"]
  }
}
```

## Status Transition Behavior
- `planning` stage:
  - planner runs and writes/updates artifacts
- if questionnaire needed:
  - transition to `awaiting_human` with structured artifact
- on human response:
  - return to `planning`
  - merge response into `planningArtifact` and `testingArtifacts.planned`
  - append transition note capturing decision outcome

## Resume and Merge Semantics
Merge policy for answers:
1. append clarification-driven steps/risks instead of destructive overwrite when possible
2. preserve existing approved goals unless explicitly superseded by human choice
3. include provenance note in `transitionNote`:
- source: human questionnaire answer
- applied fields: explicit list

## Guardrails
- no planner transition to implementing without required planned test artifacts
- questionnaire options must include a recommended option
- planner must not mutate review/verification artifacts

## Acceptance Criteria Mapping
1. planner behavior to generate plan + questionnaire:
- covered by inputs/outputs + decision logic + schema.
2. awaiting_human transition path:
- covered by status transition behavior.
3. answer resume semantics:
- covered by resume and merge semantics.

## Follow-up Implementation
- `T-00117`: implement planner adapter using these decision and schema rules.
- `T-00107`: align human review UX with questionnaire schema and resume experience.
