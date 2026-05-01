param(
  [string]$ApkPath = "builds\homeapp-release.apk",
  [string]$PackageName = "com.homeapp.mobile",
  [switch]$ClearData,
  [switch]$AllowUninstallOnSignatureMismatch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$resolvedApk = Resolve-Path -LiteralPath (Join-Path $repoRoot.Path $ApkPath)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$screenshotPath = Join-Path $repoRoot.Path "adb-homeapp-smoke-$stamp.png"
$logcatPath = Join-Path $repoRoot.Path "adb-homeapp-smoke-$stamp.log"
$uiDumpPath = Join-Path $repoRoot.Path "adb-homeapp-smoke-$stamp.xml"

function Invoke-Adb {
  param([string[]]$Arguments)

  & adb @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "adb $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Get-AdbDevice {
  $devices = & adb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() }

  if (-not $devices) {
    throw 'No ADB device found. Enable USB debugging and accept the RSA prompt on the phone.'
  }

  $unauthorized = $devices | Where-Object { $_ -match '\bunauthorized\b' }

  if ($unauthorized) {
    throw 'ADB device is unauthorized. Accept the USB debugging/RSA prompt on the phone.'
  }

  $online = $devices | Where-Object { $_ -match '\bdevice\b' } | Select-Object -First 1

  if (-not $online) {
    throw "No online ADB device found. Current adb devices output: $($devices -join '; ')"
  }

  return ($online -split '\s+')[0]
}

$device = Get-AdbDevice
Write-Host "Using ADB device: $device"

Invoke-Adb -Arguments @('-s', $device, 'logcat', '-c')

if ($ClearData) {
  & adb -s $device shell pm clear $PackageName | Out-Null
}

$installOutput = & adb -s $device install -r $resolvedApk.Path 2>&1

if ($LASTEXITCODE -ne 0) {
  $installText = $installOutput -join "`n"

  if ($AllowUninstallOnSignatureMismatch -and $installText -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE|INSTALL_FAILED_VERSION_DOWNGRADE') {
    Write-Host 'Install failed because an older/incompatible app exists. Uninstalling package and reinstalling.'
    & adb -s $device uninstall $PackageName | Out-Null
    Invoke-Adb -Arguments @('-s', $device, 'install', $resolvedApk.Path)
  } else {
    throw "adb install failed: $installText"
  }
}

Invoke-Adb -Arguments @('-s', $device, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
Invoke-Adb -Arguments @('-s', $device, 'shell', 'monkey', '-p', $PackageName, '-c', 'android.intent.category.LAUNCHER', '1')
Start-Sleep -Seconds 8

Invoke-Adb -Arguments @('-s', $device, 'shell', 'screencap', '-p', '/sdcard/homeapp-smoke.png')
Invoke-Adb -Arguments @('-s', $device, 'pull', '/sdcard/homeapp-smoke.png', $screenshotPath)
Invoke-Adb -Arguments @('-s', $device, 'shell', 'rm', '/sdcard/homeapp-smoke.png')

& adb -s $device shell uiautomator dump /sdcard/homeapp-window.xml | Out-Null
& adb -s $device pull /sdcard/homeapp-window.xml $uiDumpPath | Out-Null
& adb -s $device shell rm /sdcard/homeapp-window.xml | Out-Null

& adb -s $device logcat -d -v time > $logcatPath

Write-Host "Screenshot: $screenshotPath"
Write-Host "UI dump: $uiDumpPath"
Write-Host "Logcat: $logcatPath"
