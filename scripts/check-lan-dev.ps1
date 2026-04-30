param(
  [string]$IpAddress
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $IpAddress) {
  $IpAddress = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.InterfaceAlias -notmatch 'Loopback'
    } |
    Sort-Object @{ Expression = { if ($_.InterfaceAlias -eq 'Wi-Fi') { 0 } else { 1 } } } |
    Select-Object -First 1 -ExpandProperty IPAddress
}

if (-not $IpAddress) {
  throw 'Could not detect a LAN IPv4 address.'
}

$apiUrl = "http://${IpAddress}:3000/api/health"
$apiPort = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq 'Listen' } |
  Select-Object -First 1
$metroPort = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq 'Listen' } |
  Select-Object -First 1

Write-Host "HomeApp LAN IP: $IpAddress"
Write-Host "API URL for Android: http://${IpAddress}:3000/api"
Write-Host "Metro URL: http://${IpAddress}:8081"
Write-Host "API port 3000 listening: $([bool]$apiPort)"
Write-Host "Metro port 8081 listening: $([bool]$metroPort)"

try {
  $health = Invoke-RestMethod -Uri $apiUrl -TimeoutSec 5
  Write-Host "API LAN health: OK ($($health.service))"
} catch {
  Write-Host "API LAN health: FAILED"
  Write-Host $_.Exception.Message
  exit 1
}
