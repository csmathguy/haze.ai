param(
  [Parameter(Mandatory = $true)][string]$TaskId,
  [Parameter(Mandatory = $true)][string]$CommitMessage,
  [Parameter(Mandatory = $true)][string]$PrTitle,
  [string]$PrBodyFile = "",
  [string]$Base = "main",
  [string]$ApiBase = "http://localhost:3001",
  [switch]$Draft
)

$ErrorActionPreference = "Stop"

function Exec([string]$command) {
  Write-Host "> $command"
  Invoke-Expression $command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $command"
  }
}

function Copy-Metadata([object]$source) {
  $result = @{}
  if ($null -eq $source) {
    return $result
  }
  foreach ($p in $source.PSObject.Properties) {
    $result[$p.Name] = $p.Value
  }
  return $result
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch) {
  throw "Unable to determine current git branch"
}
if ($branch -eq "main" -or $branch -eq "master") {
  throw "Refusing to finish task on $branch"
}

$dirty = git status --porcelain
if (-not $dirty) {
  throw "No local changes to commit"
}

Exec "npm run verify"

Exec "git add -A"

$staged = git diff --cached --name-only
if (-not $staged) {
  throw "No staged changes after git add"
}

$escapedCommitMessage = $CommitMessage.Replace('"', '\"')
Exec "git commit -m \"$escapedCommitMessage\""

$headSha = (git rev-parse HEAD).Trim()
if (-not $headSha) {
  throw "Unable to determine HEAD sha"
}

Exec "git push origin HEAD"

$prArgs = @("pr", "create", "--base", $Base, "--head", $branch, "--title", $PrTitle)
if ($PrBodyFile -and (Test-Path $PrBodyFile)) {
  $prArgs += @("--body-file", $PrBodyFile)
} else {
  $prArgs += @("--fill")
}
if ($Draft) {
  $prArgs += "--draft"
}

$prUrl = (& gh @prArgs | Select-Object -Last 1).Trim()
if (-not $prUrl) {
  throw "Unable to determine PR URL"
}

$changedFiles = git show --name-only --pretty="" HEAD | Where-Object { $_.Trim() -ne "" }
$changedFilesArray = @($changedFiles)

$taskResponse = Invoke-RestMethod -Method Get -Uri "$ApiBase/tasks/$TaskId"
if (-not $taskResponse.record) {
  throw "Task $TaskId not found at $ApiBase"
}

$task = $taskResponse.record
$metadata = Copy-Metadata $task.metadata
$metadata.reviewArtifact = @{
  changeSummary = @(
    "Automated finish-task flow executed: verify, commit, push, and PR creation",
    "PR created: $prUrl"
  )
  filesTouched = $changedFilesArray
  knownRisks = @(
    "Coverage comment assumes coverage-summary files are generated in both workspaces"
  )
}
$metadata.verificationArtifact = @{
  commands = @(
    "npm run verify"
  )
  result = "passed"
  notes = @(
    "Automated via scripts/finish-task.ps1",
    "Commit: $headSha",
    "PR: $prUrl"
  )
}

$patchBody = @{
  status = "review"
  metadata = $metadata
} | ConvertTo-Json -Depth 20

$patchResponse = Invoke-RestMethod -Method Patch -Uri "$ApiBase/tasks/$TaskId" -ContentType "application/json" -Body $patchBody
if (-not $patchResponse.record -or $patchResponse.record.status -ne "review") {
  throw "Failed to transition task $TaskId to review"
}

Write-Host "Task $TaskId moved to review."
Write-Host "Commit: $headSha"
Write-Host "PR: $prUrl"
