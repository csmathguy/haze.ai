param(
  [string]$ApiBase = "http://localhost:3001"
)

$pool = Invoke-RestMethod -Method Get -Uri "$ApiBase/tasks"
$eligible = @(
  $pool.records | Where-Object {
    $_.status -eq "backlog" -and
    @($_.dependencies).Count -eq @($_.dependencies | Where-Object {
      $depId = $_
      ($pool.records | Where-Object { $_.id -eq $depId }).status -eq "done"
    }).Count
  }
)

try {
  $response = Invoke-RestMethod -Method Post -Uri "$ApiBase/tasks/actions/next"
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404) {
    Write-Output "No eligible task available"
    exit 0
  }
  throw
}

$record = $response.record
if (-not $record) {
  Write-Output "No eligible task available"
  exit 0
}

$tieCount = @($eligible | Where-Object { $_.priority -eq $record.priority }).Count

[PSCustomObject]@{
  taskId = $record.id
  title = $record.title
  priority = $record.priority
  status = $record.status
  tieCount = $tieCount
  nextStep = "Run workflow-start-task for this task to capture planningArtifact, then continue lifecycle transitions."
} | ConvertTo-Json -Depth 8
