param(
  [Parameter(Mandatory = $true)][string]$TaskId,
  [Parameter(Mandatory = $true)][ValidateSet("approved", "needs_info")][string]$Decision,
  [Parameter(Mandatory = $true)][ValidateSet("planning_agent", "human_review")][string]$Source,
  [string[]]$ReasonCodes = @(),
  [string]$ApiBase = "http://localhost:3001"
)

$ErrorActionPreference = "Stop"

$payload = @{
  decision = $Decision
  source = $Source
  reasonCodes = @($ReasonCodes | Where-Object { $_ -and $_.Trim().Length -gt 0 } | Select-Object -Unique)
} | ConvertTo-Json -Depth 8

$response = Invoke-RestMethod `
  -Method Post `
  -Uri "$ApiBase/tasks/$TaskId/planner-determination" `
  -ContentType "application/json" `
  -Body $payload

if (-not $response.record) {
  throw "Planner determination write failed for task $TaskId"
}

$record = $response.record
Write-Host "Planner determination recorded for task $TaskId"
Write-Host "Status: $($record.status)"
Write-Host "Decision: $($record.metadata.plannerDetermination.decision)"
Write-Host "Source: $($record.metadata.plannerDetermination.source)"
