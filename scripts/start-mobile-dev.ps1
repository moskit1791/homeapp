param(
  [string]$ApiUrl = $env:EXPO_PUBLIC_API_URL,
  [ValidateSet('lan', 'localhost', 'tunnel')]
  [string]$HostMode = 'lan'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $ApiUrl) {
  throw 'Set EXPO_PUBLIC_API_URL or pass -ApiUrl, for example: http://192.168.100.109:3000/api'
}

$env:EXPO_PUBLIC_API_URL = $ApiUrl

pnpm.cmd --filter @homeapp/mobile dev -- --host $HostMode
