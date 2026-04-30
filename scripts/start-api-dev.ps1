param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$AccessSecret = $env:JWT_ACCESS_SECRET,
  [string]$RefreshSecret = $env:JWT_REFRESH_SECRET,
  [switch]$Migrate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $DatabaseUrl) {
  throw 'Set DATABASE_URL or pass -DatabaseUrl, for example: postgres://postgres:<password-url-encoded>@localhost:5432/homeapp_dev'
}

if (-not $AccessSecret) {
  $AccessSecret = 'dev-access-secret-change-me-minimum-32'
}

if (-not $RefreshSecret) {
  $RefreshSecret = 'dev-refresh-secret-change-me-minimum-32'
}

$env:DATABASE_URL = $DatabaseUrl
$env:JWT_ACCESS_SECRET = $AccessSecret
$env:JWT_REFRESH_SECRET = $RefreshSecret

if ($Migrate) {
  pnpm.cmd --filter @homeapp/api db:migrate
}

pnpm.cmd --filter @homeapp/api dev
