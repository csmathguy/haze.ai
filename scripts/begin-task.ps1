param(
  [Parameter(Mandatory = $true)][string]$TaskId,
  [Parameter(Mandatory = $true)][string]$BranchName,
  [string]$BaseBranch = "main",
  [string]$ApiBase = "http://localhost:3001",
  [string]$Owner = "codex",
  [string[]]$Goals = @(),
  [string[]]$Steps = @(),
  [string[]]$Risks = @()
)

$ErrorActionPreference = "Stop"

./scripts/start-task-branch.ps1 -TaskId $TaskId -BranchName $BranchName -BaseBranch $BaseBranch -ApiBase $ApiBase | Out-Null

$task = (Invoke-RestMethod -Method Get -Uri "$ApiBase/tasks/$TaskId").record
if (-not $task) {
  throw "Task not found via API: $TaskId"
}

$metadata = @{}
if ($task.metadata) {
  foreach ($p in $task.metadata.PSObject.Properties) {
    $metadata[$p.Name] = $p.Value
  }
}

$workflow = @{}
if ($metadata.workflow) {
  foreach ($p in $metadata.workflow.PSObject.Properties) {
    $workflow[$p.Name] = $p.Value
  }
}
$workflow.owner = $Owner
$metadata.workflow = $workflow

$goalList = if ($Goals.Count -gt 0) { $Goals } else { @("Define planning goals for this task") }
$stepList = if ($Steps.Count -gt 0) { $Steps } else { @("Define implementation steps for this task") }
$riskList = if ($Risks.Count -gt 0) { $Risks } else { @("Identify key execution risks for this task") }

$metadata.planningArtifact = @{
  createdAt = (Get-Date).ToString("o")
  goals = $goalList
  steps = $stepList
  risks = $riskList
}
$metadata.transitionNote = "Begin-task script created branch and planning artifact; awaiting plan approval."

$patch = @{
  status = "planning"
  metadata = $metadata
} | ConvertTo-Json -Depth 25

$updated = Invoke-RestMethod -Method Patch -Uri "$ApiBase/tasks/$TaskId" -ContentType "application/json" -Body $patch
if (-not $updated.record -or $updated.record.status -ne "planning") {
  throw "Failed to keep task in planning after begin-task update: $TaskId"
}

[PSCustomObject]@{
  taskId = $updated.record.id
  status = $updated.record.status
  branchName = $BranchName
  owner = $Owner
  nextStep = "Review and approve planningArtifact before transition to implementing."
} | ConvertTo-Json -Depth 8
