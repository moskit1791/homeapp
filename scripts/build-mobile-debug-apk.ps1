param(
  [string]$WorkDir = 'C:\ha'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$repoPath = $repoRoot.Path

if (-not (Test-Path -LiteralPath $WorkDir)) {
  New-Item -ItemType Directory -Path $WorkDir | Out-Null
}

$resolvedWorkDir = Resolve-Path -LiteralPath $WorkDir

if ($resolvedWorkDir.Path -eq $repoPath) {
  throw 'WorkDir cannot be the repository root.'
}

$excludedDirectories = @(
  (Join-Path $repoPath 'node_modules'),
  (Join-Path $repoPath '.git'),
  (Join-Path $repoPath '.turbo'),
  (Join-Path $repoPath 'apps\mobile\.expo'),
  (Join-Path $repoPath 'apps\mobile\android\build'),
  (Join-Path $repoPath 'apps\mobile\tmp-assets'),
  (Join-Path $repoPath 'apps\mobile\dist')
)

robocopy $repoPath $resolvedWorkDir.Path /E /XD $excludedDirectories /XF *.log | Out-Null
if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

Push-Location $resolvedWorkDir.Path
try {
  pnpm.cmd install
  pnpm.cmd --filter @homeapp/mobile typecheck
  pnpm.cmd --filter @homeapp/mobile lint

  Push-Location (Join-Path $resolvedWorkDir.Path 'apps\mobile\android')
  try {
    $env:NODE_ENV = 'development'
    .\gradlew.bat clean assembleDebug --max-workers=1
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

$sourceApk = Join-Path $resolvedWorkDir.Path 'apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk'
$buildsDir = Join-Path $repoPath 'builds'
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$latestApk = Join-Path $buildsDir 'homeapp-debug.apk'
$stampedApk = Join-Path $buildsDir "homeapp-debug-$stamp.apk"

New-Item -ItemType Directory -Path $buildsDir -Force | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $latestApk -Force
Copy-Item -LiteralPath $sourceApk -Destination $stampedApk -Force

Get-Item -LiteralPath $latestApk, $stampedApk |
  Select-Object FullName, Length, LastWriteTime
