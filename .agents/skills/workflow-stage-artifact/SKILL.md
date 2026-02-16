---
name: workflow-stage-artifact
description: Capture stage-specific execution artifacts in task metadata for planning, review, verification, and awaiting_human workflow states.
---

# Workflow Stage Artifact

## Purpose
Standardize what evidence is attached when changing task stages.

## Artifact schema
- `planningArtifact`
  - `goals` (array)
  - `implementationSteps` (array)
  - `risks` (array)
  - `recommendedDefault` (string)
- `reviewArtifact`
  - `changeSummary` (array)
  - `filesTouched` (array)
  - `knownRisks` (array)
- `verificationArtifact`
  - `commands` (array)
  - `result` (string)
  - `notes` (array)
- `awaitingHumanArtifact`
  - `question` (string)
  - `options` (array)
  - `recommendedDefault` (string)

## Procedure
1. Read task record.
2. Merge artifact fields into `metadata` (preserve existing keys).
3. Patch task with updated metadata via `PATCH /tasks/:id`.
4. Re-read task and confirm artifact persisted.

## Validation
- Ensure artifact keys map to current stage.
- Ensure arrays are concise and actionable.
- Ensure `awaitingHumanArtifact` includes explicit options and recommended default.
