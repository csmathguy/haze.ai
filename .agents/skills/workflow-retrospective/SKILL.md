---
name: workflow-retrospective
description: Run a structured agent retrospective at context boundaries, persist it on the active task, and capture audit evidence.
---

# Workflow Retrospective

## Inputs
- `taskId`
- `scope` (for example `Context window checkpoint`)
- retrospective sections:
  - `wentWell`
  - `didNotGoWell`
  - `couldBeBetter`
  - `missingSkills`
  - `missingDataPoints`
  - `efficiencyNotes`
  - `actionItems` (title, owner, priority, notes)
  - `sources`

## Procedure
1. Set API base:
```powershell
$base = if ($env:HAZE_API_BASE) { $env:HAZE_API_BASE } else { "http://localhost:3001" }
```
2. Run deterministic retrospective capture:
```powershell
./scripts/run-retrospective.ps1 `
  -TaskId "<TASK_ID>" `
  -ApiBase $base `
  -Scope "Context window checkpoint" `
  -WentWell @("...") `
  -DidNotGoWell @("...") `
  -CouldBeBetter @("...") `
  -MissingSkills @("...") `
  -MissingDataPoints @("...") `
  -EfficiencyNotes @("...") `
  -Sources @("https://...") `
  -ActionItemsJson '[{"title":"...","owner":"agent","priority":"low","notes":"..."}]'
```
3. Review retrospective output with user.
4. Create follow-up backlog tasks for agreed action items.

## Validation
1. Confirm task metadata now includes:
- `metadata.retrospectives[]`
- `metadata.latestRetrospective`
2. Confirm audit includes `task_retrospective_recorded`.

## Output
- task id
- retrospective count
- latest retrospective timestamp
- proposed follow-up tasks (if any)

