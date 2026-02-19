param(
  [string]$ApiBase = "http://localhost:3001",
  [string]$PlannerCommand = "codex",
  [string[]]$PlannerArgs = @(),
  [int]$Limit = 20,
  [string]$TaskId = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-PlanningTasks([string]$base, [int]$limit, [string]$taskId) {
  if ($taskId -and $taskId.Trim().Length -gt 0) {
    $task = (Invoke-RestMethod -Method Get -Uri "$base/tasks/$taskId").record
    if ($task.status -ne "planning") {
      return @()
    }
    return @($task)
  }

  $all = (Invoke-RestMethod -Method Get -Uri "$base/tasks?status=planning").records
  return @($all | Select-Object -First $limit)
}

function Read-StringArray([object]$value) {
  if ($null -eq $value) {
    return @()
  }
  if ($value -isnot [System.Array]) {
    return @()
  }
  return @($value | Where-Object { $_ -is [string] -and $_.Trim().Length -gt 0 } | ForEach-Object { $_.Trim() })
}

function Get-HeuristicDecision([object]$task) {
  $meta = $task.metadata
  $planningArtifact = $meta.planningArtifact
  $planned = $meta.testingArtifacts.planned

  $missing = @()
  if ((Read-StringArray $meta.acceptanceCriteria).Count -eq 0) { $missing += "MISSING_ACCEPTANCE_CRITERIA" }
  if ((Read-StringArray $planningArtifact.goals).Count -eq 0) { $missing += "MISSING_PLANNING_GOALS" }
  if ((Read-StringArray $planningArtifact.steps).Count -eq 0) { $missing += "MISSING_PLANNING_STEPS" }
  if ((Read-StringArray $planned.gherkinScenarios).Count -eq 0) { $missing += "MISSING_GHERKIN_SCENARIOS" }
  if ((Read-StringArray $planned.unitTestIntent).Count -eq 0) { $missing += "MISSING_UNIT_TEST_INTENT" }
  if ((Read-StringArray $planned.integrationTestIntent).Count -eq 0) { $missing += "MISSING_INTEGRATION_TEST_INTENT" }
  if ($meta.awaitingHumanArtifact -and $meta.awaitingHumanArtifact.question) { $missing += "AWAITING_HUMAN_OPEN" }

  if ($missing.Count -gt 0) {
    return @{
      decision = "needs_info"
      reasonCodes = @($missing | Select-Object -Unique)
      source = "heuristic"
    }
  }

  return @{
    decision = "approved"
    reasonCodes = @()
    source = "heuristic"
  }
}

function Invoke-PlanningCli([string]$command, [string[]]$args, [object]$task) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    return $null
  }

  $promptPayload = @{
    schema = @{
      decision = "approved|needs_info"
      reasonCodes = @("MACHINE_READABLE_REASON_CODE")
    }
    task = @{
      id = $task.id
      title = $task.title
      description = $task.description
      metadata = $task.metadata
    }
    instruction = "Return JSON only. Decide if planning is ready for architecture review."
  } | ConvertTo-Json -Depth 20

  try {
    $raw = if ($args.Count -gt 0) {
      $promptPayload | & $command @args 2>$null
    } else {
      $promptPayload | & $command 2>$null
    }
    if (-not $raw) {
      return $null
    }

    $joined = @($raw) -join "`n"
    $parsed = $joined | ConvertFrom-Json
    $decision = "$($parsed.decision)".Trim().ToLowerInvariant()
    $codes = Read-StringArray $parsed.reasonCodes
    if ($decision -ne "approved" -and $decision -ne "needs_info") {
      return $null
    }

    return @{
      decision = $decision
      reasonCodes = $codes
      source = "cli"
    }
  } catch {
    return $null
  }
}

function Record-Determination([string]$base, [object]$task, [object]$decision, [bool]$dryRun) {
  if ($dryRun) {
    Write-Host "[DRY-RUN] $($task.id) -> $($decision.decision) ($($decision.reasonCodes -join ', '))"
    return
  }

  $payload = @{
    decision = $decision.decision
    source = "planning_agent"
    reasonCodes = @($decision.reasonCodes)
  } | ConvertTo-Json -Depth 8

  Invoke-RestMethod `
    -Method Post `
    -Uri "$base/tasks/$($task.id)/planner-determination" `
    -ContentType "application/json" `
    -Body $payload | Out-Null

  Write-Host "Stamped $($task.id) as $($decision.decision) via planning_agent"
}

$tasks = Get-PlanningTasks -base $ApiBase -limit $Limit -taskId $TaskId
if ($tasks.Count -eq 0) {
  Write-Host "No planning tasks to evaluate."
  exit 0
}

foreach ($task in $tasks) {
  $heuristic = Get-HeuristicDecision -task $task
  $cliDecision = Invoke-PlanningCli -command $PlannerCommand -args $PlannerArgs -task $task
  $decision = if ($cliDecision) { $cliDecision } else { $heuristic }

  Record-Determination -base $ApiBase -task $task -decision $decision -dryRun:$DryRun
}

Write-Host "Planning agent run complete. Evaluated $($tasks.Count) task(s)."
