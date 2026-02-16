param(
  [Parameter(Mandatory = $true)][string]$TaskId,
  [Parameter(Mandatory = $true)][string]$BranchName,
  [string]$BaseBranch = "main",
  [string]$ApiBase = "http://localhost:3001"
)

$clean = git status --porcelain
if ($clean) {
  throw "Working tree is not clean. Commit or stash changes before branching."
}

$current = git branch --show-current
if ($current -ne $BaseBranch) {
  git checkout $BaseBranch
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to checkout base branch $BaseBranch"
  }
}

git pull --ff-only
if ($LASTEXITCODE -ne 0) {
  throw "Failed to fast-forward pull on $BaseBranch"
}

git checkout -b $BranchName
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create branch $BranchName"
}

$task = (Invoke-RestMethod -Method Get -Uri "$ApiBase/tasks/$TaskId").record

$metadata = @{}
if ($task.metadata) {
  foreach ($p in $task.metadata.PSObject.Properties) {
    $metadata[$p.Name] = $p.Value
  }
}
$metadata.workflow = @{
  branchName = $BranchName
  baseBranch = $BaseBranch
  branchCreatedAt = (Get-Date).ToString("o")
}

$patch = @{ metadata = $metadata } | ConvertTo-Json -Depth 20
Invoke-RestMethod -Method Patch -Uri "$ApiBase/tasks/$TaskId" -ContentType "application/json" -Body $patch | Out-Null

Write-Output "Created branch $BranchName for task $TaskId and recorded metadata.workflow"
