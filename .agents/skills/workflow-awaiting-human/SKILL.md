---
name: workflow-awaiting-human
description: Move a task to awaiting_human with a structured questionnaire payload and recommended default when agent progress is blocked by missing user input.
---

# Workflow Awaiting Human

## Questionnaire payload
Write `metadata.awaitingHumanArtifact`:
- `question`
- `options` (2-3 concrete options)
- `recommendedDefault`
- `blockingReason`

## Procedure
1. Patch task status to `awaiting_human`.
2. Attach questionnaire payload.
3. After user answer, summarize decision and transition task to `backlog` (or `planning` if continuing same plan).

## Output
- task id
- blocking question
- options
- recommended default
