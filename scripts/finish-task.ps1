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

function Resolve-CanonicalTaskId([object]$task, [string]$fallbackTaskId) {
  if ($task -and $task.metadata -and $task.metadata.canonicalTaskId) {
    return "$($task.metadata.canonicalTaskId)"
  }
  return $fallbackTaskId
}

function Get-TaskRecord([string]$apiBase, [string]$taskId) {
  $taskResponse = Invoke-RestMethod -Method Get -Uri "$apiBase/tasks/$taskId"
  if (-not $taskResponse.record) {
    throw "Task not found via API: $taskId"
  }
  return $taskResponse.record
}

function Unique-Strings([string[]]$values) {
  return @($values | Where-Object { $_ -and $_.Trim().Length -gt 0 } | Select-Object -Unique)
}

function To-StringArray([object]$value) {
  if ($null -eq $value) {
    return @()
  }
  if ($value -is [System.Array]) {
    return @($value | ForEach-Object { "$_" })
  }
  return @("$value")
}

function Merge-StringArrays([object]$current, [string[]]$additional) {
  $combined = @((To-StringArray $current) + $additional)
  return Unique-Strings $combined
}

function Resolve-ChangeType([object]$task, [string[]]$changedFiles) {
  $tags = @()
  if ($task.tags) {
    $tags = @($task.tags | ForEach-Object { "$_".ToLowerInvariant() })
  }

  if ($tags -contains "bug" -or $tags -contains "bugfix" -or $tags -contains "fix" -or $tags -contains "regression") {
    return "Bug fix"
  }
  if ($tags -contains "refactor" -or $tags -contains "cleanup") {
    return "Refactor"
  }
  if ($tags -contains "workflow" -or $tags -contains "docs" -or $tags -contains "documentation") {
    return "Docs/Workflow"
  }
  if ($changedFiles | Where-Object { $_ -match "^documentation/" -or $_ -match "^\.github/" }) {
    return "Docs/Workflow"
  }
  return "Feature"
}

function Build-PopulatedPrBody(
  [object]$task,
  [string]$taskId,
  [string]$branch,
  [string]$headSha,
  [string[]]$changedFiles
) {
  $canonicalTaskId = Resolve-CanonicalTaskId -task $task -fallbackTaskId $taskId
  $changeType = Resolve-ChangeType -task $task -changedFiles $changedFiles
  $acceptanceCriteria = To-StringArray $task.metadata.acceptanceCriteria
  $references = Merge-StringArrays -current $task.metadata.references -additional @()
  $references = Merge-StringArrays -current $references -additional (To-StringArray $task.metadata.links)
  $references = Merge-StringArrays -current $references -additional (To-StringArray $task.metadata.researchReferences)
  $risks = To-StringArray $task.metadata.planningArtifact.risks
  if ($risks.Count -eq 0) {
    $risks = @("No major risks explicitly recorded in task metadata.")
  }

  $focusAreas = @()
  if ($acceptanceCriteria.Count -gt 0) {
    $focusAreas = @($acceptanceCriteria | Select-Object -First 3)
  } else {
    $focusAreas = @("Validate changed files and workflow side effects.")
  }

  $isBugFix = if ($changeType -eq "Bug fix") { "x" } else { " " }
  $isFeature = if ($changeType -eq "Feature") { "x" } else { " " }
  $isRefactor = if ($changeType -eq "Refactor") { "x" } else { " " }
  $isDocsWorkflow = if ($changeType -eq "Docs/Workflow") { "x" } else { " " }

  $lines = @(
    "## Summary (Required)",
    "- $($task.title)",
    "- Task: $canonicalTaskId",
    "- Why: $($task.description)",
    "",
    "## Change Type (Required)",
    "- [$isBugFix] Bug fix",
    "- [$isFeature] Feature",
    "- [$isRefactor] Refactor",
    "- [$isDocsWorkflow] Docs/Workflow",
    "",
    "## Testing Evidence (Required)",
    "- Commands run: npm run verify",
    "- Result: pass",
    "",
    "## Risks and Rollback (Required)"
  )

  foreach ($risk in $risks) {
    $lines += "- Risk: $risk"
  }
  $lines += "- Rollback: revert commit $headSha and re-run npm run verify."
  $lines += ""
  $lines += "## Reviewer Focus Areas (Required)"
  foreach ($area in $focusAreas) {
    $lines += "- $area"
  }
  $lines += ""
  $lines += "## References (Optional)"
  if ($references.Count -eq 0) {
    $lines += "- None recorded"
  } else {
    foreach ($reference in $references) {
      $lines += "- $reference"
    }
  }
  $lines += ""
  $lines += "## Additional Context (Optional)"
  $lines += "- Branch: $branch"
  $lines += "- Commit: $headSha"
  $lines += "- Files changed:"
  foreach ($file in $changedFiles) {
    $lines += "- $file"
  }

  return ($lines -join "`n")
}

function Resolve-PrBodyFile(
  [string]$explicitPath,
  [object]$task,
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

  $tempPath = Join-Path ([System.IO.Path]::GetTempPath()) ("haze-pr-body-" + [System.Guid]::NewGuid().ToString("N") + ".md")
  $body = Build-PopulatedPrBody `
    -task $task `
    -taskId $taskId `
    -branch $branch `
    -headSha $headSha `
    -changedFiles $changedFiles
  Set-Content -Path $tempPath -Value $body -NoNewline
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
  $testingArtifacts = Copy-Metadata $metadata.testingArtifacts
  $testingPlanned = Copy-Metadata $testingArtifacts.planned
  $testingImplemented = Copy-Metadata $testingArtifacts.implemented

  $testingImplemented.testsAddedOrUpdated = Merge-StringArrays `
    -current $testingImplemented.testsAddedOrUpdated `
    -additional @($artifacts.reviewArtifact.filesTouched)
  $testingImplemented.commandsRun = Merge-StringArrays `
    -current $testingImplemented.commandsRun `
    -additional @($artifacts.verificationArtifact.commands)
  if (-not $testingImplemented.notes) {
    $testingImplemented.notes = "Captured during finish-task verification handoff."
  }

  $testingArtifacts.schemaVersion = "1.0"
  $testingArtifacts.planned = $testingPlanned
  $testingArtifacts.implemented = $testingImplemented
  $metadata.testingArtifacts = $testingArtifacts

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

$task = Get-TaskRecord -apiBase $ApiBase -taskId $TaskId
$changedFiles = @(git show --name-only --pretty="" HEAD | Where-Object { $_.Trim() -ne "" })
$resolvedPrBody = Resolve-PrBodyFile `
  -explicitPath $PrBodyFile `
  -task $task `
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
