param(
  [string]$TasksFile = "apps/backend/data/tasks/tasks.json"
)

if (-not (Test-Path $TasksFile)) {
  Write-Output "T-00001"
  exit 0
}

$json = Get-Content $TasksFile -Raw | ConvertFrom-Json
$max = 0

foreach ($task in $json.tasks) {
  if ($task.id -match '^T-(\d{5})$') {
    $num = [int]$matches[1]
    if ($num -gt $max) {
      $max = $num
    }
  }
}

$next = $max + 1
Write-Output ("T-{0:D5}" -f $next)
