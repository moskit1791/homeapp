param(
  [string]$ApiUrl = $env:EXPO_PUBLIC_API_URL,
  [string]$GoogleAndroidClientId = $env:EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  [string]$GoogleOAuthClientId = $env:EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
  [string]$GoogleWebClientId = $env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  [switch]$AllowMissingGoogleOAuth,
  [switch]$UseLanApi,
  [string]$WorkDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProductionApiUrl = 'https://app.porabkihome.pl/api'

function Assert-LastExitCode {
  param(
    [string]$Step
  )

  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

function Get-DefaultLanIp {
  $configs = Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address -and $_.NetAdapter.Status -eq 'Up' }

  foreach ($config in $configs) {
    foreach ($address in $config.IPv4Address) {
      if ($address.IPAddress -and
          $address.IPAddress -notlike '169.254.*' -and
          $address.IPAddress -ne '127.0.0.1') {
        return $address.IPAddress
      }
    }
  }

  return $null
}

if (-not $ApiUrl) {
  if ($UseLanApi) {
    $ipAddress = Get-DefaultLanIp
    if (-not $ipAddress) {
      throw 'Could not detect LAN IP. Pass -ApiUrl, for example: http://192.168.1.20:3000/api'
    }

    $ApiUrl = "http://${ipAddress}:3000/api"
  } else {
    $ApiUrl = $ProductionApiUrl
  }
}

if (-not $GoogleOAuthClientId) {
  $GoogleOAuthClientId = $env:GOOGLE_OAUTH_CLIENT_ID
}

if (-not $GoogleAndroidClientId -and $GoogleOAuthClientId) {
  $GoogleAndroidClientId = $GoogleOAuthClientId
}

if (-not $GoogleOAuthClientId -and $GoogleAndroidClientId) {
  $GoogleOAuthClientId = $GoogleAndroidClientId
}

if ($ApiUrl -eq $ProductionApiUrl -and -not $GoogleAndroidClientId -and -not $AllowMissingGoogleOAuth) {
  throw 'Refusing to build production APK without Google OAuth client ID. Pass -GoogleAndroidClientId, set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID/GOOGLE_OAUTH_CLIENT_ID, or use -AllowMissingGoogleOAuth intentionally.'
}

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$repoPath = $repoRoot.Path

if (-not $WorkDir) {
  $rootPath = [System.IO.Path]::GetPathRoot($repoPath)
  $WorkDir = Join-Path $rootPath ('h-apk-' + (Get-Date -Format 'MMdd-HHmmss'))
}

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
  '.tmp-apk-build-*',
  (Join-Path $repoPath 'apps\mobile\.expo'),
  (Join-Path $repoPath 'apps\mobile\android\build'),
  (Join-Path $repoPath 'apps\mobile\tmp-assets'),
  (Join-Path $repoPath 'apps\mobile\dist')
)

robocopy $repoPath $resolvedWorkDir.Path /E /XD $excludedDirectories /XF *.log | Out-Null
if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

$nodeModulesPath = Join-Path $resolvedWorkDir.Path 'node_modules'
if (Test-Path -LiteralPath $nodeModulesPath) {
  $resolvedNodeModulesPath = (Resolve-Path -LiteralPath $nodeModulesPath).Path
  if (-not $resolvedNodeModulesPath.StartsWith($resolvedWorkDir.Path, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove node_modules outside WorkDir: $resolvedNodeModulesPath"
  }

  try {
    Remove-Item -LiteralPath "\\?\$resolvedNodeModulesPath" -Recurse -Force
  } catch {
    throw "Could not remove existing node_modules in $resolvedWorkDir. Pass a fresh short -WorkDir, for example C:\h4. $($_.Exception.Message)"
  }
}

Set-Content -LiteralPath (Join-Path $resolvedWorkDir.Path '.npmrc') -Value "node-linker=hoisted`n" -Encoding ASCII

Push-Location $resolvedWorkDir.Path
try {
  $env:EXPO_PUBLIC_API_URL = $ApiUrl
  if ($GoogleAndroidClientId) {
    $env:EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = $GoogleAndroidClientId
  }
  if ($GoogleOAuthClientId) {
    $env:EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = $GoogleOAuthClientId
    $env:GOOGLE_OAUTH_CLIENT_ID = $GoogleOAuthClientId
  }
  if ($GoogleWebClientId) {
    $env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = $GoogleWebClientId
  }

  pnpm.cmd install
  Assert-LastExitCode 'pnpm install'
  pnpm.cmd --filter @homeapp/shared-types build
  Assert-LastExitCode 'shared-types build'
  pnpm.cmd --filter @homeapp/shared-validation build
  Assert-LastExitCode 'shared-validation build'
  pnpm.cmd --filter @homeapp/mobile typecheck
  Assert-LastExitCode 'mobile typecheck'
  pnpm.cmd --filter @homeapp/mobile lint
  Assert-LastExitCode 'mobile lint'

  Push-Location (Join-Path $resolvedWorkDir.Path 'apps\mobile\android')
  try {
    $env:NODE_ENV = 'production'
    .\gradlew.bat clean assembleRelease --max-workers=1
    Assert-LastExitCode 'Gradle release build'
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

$sourceApk = Join-Path $resolvedWorkDir.Path 'apps\mobile\android\app\build\outputs\apk\release\app-release.apk'
$buildsDir = Join-Path $repoPath 'builds'
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$latestApk = Join-Path $buildsDir 'homeapp-release.apk'
$stampedApk = Join-Path $buildsDir "homeapp-release-$stamp.apk"

New-Item -ItemType Directory -Path $buildsDir -Force | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $latestApk -Force
Copy-Item -LiteralPath $sourceApk -Destination $stampedApk -Force

Write-Host "Built standalone APK with EXPO_PUBLIC_API_URL=$ApiUrl"
Write-Host ("Google Android OAuth client ID included: " + [string][bool]$GoogleAndroidClientId)
Write-Host ("Google Web OAuth client ID included: " + [string][bool]$GoogleWebClientId)
Get-Item -LiteralPath $latestApk, $stampedApk |
  Select-Object FullName, Length, LastWriteTime
