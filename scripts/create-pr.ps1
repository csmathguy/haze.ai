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

$args = @("pr", "create", "--base", $Base, "--head", $branch, "--title", $Title)
if ($BodyFile -and (Test-Path $BodyFile)) {
  $args += @("--body-file", $BodyFile)
} else {
  $args += @("--fill")
}
if ($Draft) {
  $args += "--draft"
}

& gh @args
if ($LASTEXITCODE -ne 0) {
  throw "gh pr create failed"
}
