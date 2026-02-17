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

function Run-Command(
  [string]$file,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$args
) {
  Write-Host "> $file $($args -join ' ')"
  & $file @args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $file $($args -join ' ')"
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

function Build-Artifacts([string]$prUrl, [string]$headSha, [string[]]$changedFiles) {
  return @{
    reviewArtifact = @{
      changeSummary = @(
        "Automated finish-task flow executed: verify, commit, push, and PR creation",
        "PR created: $prUrl"
      )
      pullRequestUrl = $prUrl
      filesTouched = $changedFiles
      knownRisks = @(
        "Coverage comment assumes coverage-summary files are generated in both workspaces"
      )
    }
    verificationArtifact = @{
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
  }
}

function Get-PrNumberFromUrl([string]$prUrl) {
  if (-not $prUrl) {
    return $null
  }
  if ($prUrl -match "/pull/(\d+)") {
    return $Matches[1]
  }
  return $null
}

function Resolve-PrBodyFile(
  [string]$explicitPath,
  [string]$taskId,
  [string]$branch,
  [string]$headSha,
  [string[]]$changedFiles
) {
  if ($explicitPath -and (Test-Path $explicitPath)) {
    return @{
      path = $explicitPath
      isTemp = $false
    }
  }

  $templatePath = Join-Path (Get-Location) ".github/pull_request_template.md"
  if (-not (Test-Path $templatePath)) {
    return @{
      path = ""
      isTemp = $false
    }
  }

  $tempPath = Join-Path ([System.IO.Path]::GetTempPath()) ("haze-pr-body-" + [System.Guid]::NewGuid().ToString("N") + ".md")
  Copy-Item -Path $templatePath -Destination $tempPath -Force

  $details = @(
    "",
    "## Auto-Populated Context",
    "- Task: $taskId",
    "- Branch: $branch",
    "- Commit: $headSha",
    "- Verification: ``npm run verify`` (passed in finish-task flow)",
    "- Files changed:"
  )
  foreach ($file in $changedFiles) {
    $details += "- $file"
  }

  Add-Content -Path $tempPath -Value $details
  return @{
    path = $tempPath
    isTemp = $true
  }
}

function Update-TaskViaApi([string]$apiBase, [string]$taskId, [hashtable]$artifacts) {
  $taskResponse = Invoke-RestMethod -Method Get -Uri "$apiBase/tasks/$taskId"
  if (-not $taskResponse.record) {
    throw "Task not found via API: $taskId"
  }

  $task = $taskResponse.record
  $metadata = Copy-Metadata $task.metadata
  $workflow = Copy-Metadata $metadata.workflow
  $github = Copy-Metadata $metadata.github
  $prUrl = $artifacts.reviewArtifact.pullRequestUrl
  $prNumber = Get-PrNumberFromUrl -prUrl $prUrl

  $workflow.pullRequestUrl = $prUrl
  if ($prNumber) {
    $workflow.pullRequestNumber = $prNumber
  }
  $metadata.workflow = $workflow

  $github.prUrl = $prUrl
  if ($prNumber) {
    $github.pullRequestNumber = $prNumber
  }
  $metadata.github = $github

  $metadata.reviewArtifact = $artifacts.reviewArtifact
  $metadata.verificationArtifact = $artifacts.verificationArtifact

  # Step 1: persist metadata artifacts first so transition validation can read them.
  $metadataPatchBody = @{
    metadata = $metadata
  } | ConvertTo-Json -Depth 20

  Invoke-RestMethod -Method Patch -Uri "$apiBase/tasks/$taskId" -ContentType "application/json" -Body $metadataPatchBody | Out-Null

  # Step 2: transition status to review.
  $statusPatchBody = @{
    status = "review"
  } | ConvertTo-Json -Depth 20

  $patchResponse = Invoke-RestMethod -Method Patch -Uri "$apiBase/tasks/$taskId" -ContentType "application/json" -Body $statusPatchBody
  if (-not $patchResponse.record -or $patchResponse.record.status -ne "review") {
    throw "Failed to transition task to review: $taskId"
  }
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

Run-Command "npm" "run" "verify"
Run-Command "git" "add" "-A"

$staged = git diff --cached --name-only
if (-not $staged) {
  throw "No staged changes after git add"
}

Run-Command "git" "commit" "-m" $CommitMessage

$headSha = (git rev-parse HEAD).Trim()
if (-not $headSha) {
  throw "Unable to determine HEAD sha"
}

$changedFiles = @(git show --name-only --pretty="" HEAD | Where-Object { $_.Trim() -ne "" })
$resolvedPrBody = Resolve-PrBodyFile `
  -explicitPath $PrBodyFile `
  -taskId $TaskId `
  -branch $branch `
  -headSha $headSha `
  -changedFiles $changedFiles

Run-Command "git" "push" "origin" "HEAD"

$prArgs = @("pr", "create", "--base", $Base, "--head", $branch, "--title", $PrTitle)
if ($resolvedPrBody.path) {
  $prArgs += @("--body-file", $resolvedPrBody.path)
} else {
  $prArgs += @("--fill")
}
if ($Draft) {
  $prArgs += "--draft"
}

Write-Host "> gh $($prArgs -join ' ')"
$prUrl = ""
try {
  $prUrl = (& gh @prArgs | Select-Object -Last 1).Trim()
} catch {
  # If a PR already exists for this branch, reuse it.
  $existingUrl = (& gh pr view $branch --json url --jq ".url" 2>$null).Trim()
  if (-not $existingUrl) {
    throw
  }
  $prUrl = $existingUrl
}
if (-not $prUrl) {
  throw "Unable to determine PR URL"
}

if ($resolvedPrBody.path) {
  Run-Command "gh" "pr" "edit" $prUrl "--body-file" $resolvedPrBody.path
}

$artifacts = Build-Artifacts -prUrl $prUrl -headSha $headSha -changedFiles $changedFiles

Update-TaskViaApi -apiBase $ApiBase -taskId $TaskId -artifacts $artifacts

if ($resolvedPrBody.isTemp) {
  Remove-Item -Path $resolvedPrBody.path -Force -ErrorAction SilentlyContinue
}

Write-Host "Task $TaskId moved to review."
Write-Host "Commit: $headSha"
Write-Host "PR: $prUrl"
