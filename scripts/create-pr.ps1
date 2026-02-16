param(
  [Parameter(Mandatory = $true)][string]$Title,
  [string]$BodyFile = "",
  [string]$Base = "main",
  [switch]$Draft
)

# Ensure clean checks before opening PR.
npm run verify
if ($LASTEXITCODE -ne 0) {
  throw "verify failed; aborting PR creation"
}

$branch = git rev-parse --abbrev-ref HEAD
if (-not $branch) {
  throw "Unable to determine current git branch"
}

# Push current branch so PR references the latest remote commit.
git push origin HEAD
if ($LASTEXITCODE -ne 0) {
  throw "git push origin HEAD failed"
}

$args = @("pr", "create", "--base", $Base, "--head", $branch, "--title", $Title)
if ($BodyFile -and (Test-Path $BodyFile)) {
  $args += @("--body-file", $BodyFile)
} else {
  $args += @("--fill")
}
if ($Draft) {
  $args += "--draft"
}

try {
  & gh @args
  if ($LASTEXITCODE -ne 0) {
    throw "gh pr create failed"
  }
} catch {
  # If a PR already exists for this branch, reuse it instead of failing.
  $existing = & gh pr view $branch --json url --jq ".url" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $existing) {
    throw "gh pr create failed"
  }
  Write-Output $existing
}
