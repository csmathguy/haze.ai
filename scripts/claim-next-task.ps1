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

$priorityTies = @($eligible | Where-Object { $_.priority -eq $record.priority })
$maxDependentCount = 0
if ($priorityTies.Count -gt 0) {
  $maxDependentCount = ($priorityTies | ForEach-Object { @($_.dependents).Count } | Measure-Object -Maximum).Maximum
}
$tieCount = @($priorityTies | Where-Object { @($_.dependents).Count -eq $maxDependentCount }).Count

[PSCustomObject]@{
  taskId = $record.id
  title = $record.title
  priority = $record.priority
  status = $record.status
  tieCount = $tieCount
  nextStep = "Run scripts/begin-task.ps1 for this task to create branch + planningArtifact, then await plan approval before implementing."
} | ConvertTo-Json -Depth 8
