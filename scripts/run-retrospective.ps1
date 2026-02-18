param(
  [Parameter(Mandatory = $true)][string]$TaskId,
  [string]$ApiBase = "http://localhost:3001",
  [Parameter(Mandatory = $true)][string]$Scope,
  [string[]]$WentWell = @(),
  [string[]]$DidNotGoWell = @(),
  [string[]]$CouldBeBetter = @(),
  [string[]]$MissingSkills = @(),
  [string[]]$MissingDataPoints = @(),
  [string[]]$EfficiencyNotes = @(),
  [string[]]$Sources = @(),
  [string]$ActionItemsJson = "[]"
)

$ErrorActionPreference = "Stop"

$actionItems = @()
if ($ActionItemsJson -and $ActionItemsJson.Trim().Length -gt 0) {
  $parsed = ConvertFrom-Json -InputObject $ActionItemsJson
  if ($parsed -is [System.Array]) {
    $actionItems = $parsed
  } elseif ($null -ne $parsed) {
    $actionItems = @($parsed)
  }
}

$payload = @{
  scope = $Scope
  wentWell = $WentWell
  didNotGoWell = $DidNotGoWell
  couldBeBetter = $CouldBeBetter
  missingSkills = $MissingSkills
  missingDataPoints = $MissingDataPoints
  efficiencyNotes = $EfficiencyNotes
  actionItems = $actionItems
  sources = $Sources
} | ConvertTo-Json -Depth 20

$response = Invoke-RestMethod `
  -Method Post `
  -Uri "$ApiBase/tasks/$TaskId/retrospectives" `
  -ContentType "application/json" `
  -Body $payload

[PSCustomObject]@{
  taskId = $response.record.id
  status = $response.record.status
  retrospectiveCount = @($response.record.metadata.retrospectives).Count
  latestRetrospectiveAt = $response.record.metadata.latestRetrospective.createdAt
} | ConvertTo-Json -Depth 10
