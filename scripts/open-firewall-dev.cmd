@echo off
setlocal

net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b 0
)

netsh advfirewall firewall add rule name="HomeApp Dev API" dir=in action=allow protocol=TCP localport=3000 profile=any >nul
netsh advfirewall firewall add rule name="HomeApp Dev Metro" dir=in action=allow protocol=TCP localport=8081 profile=any >nul

echo Firewall rules added for HomeApp Dev API :3000 and Metro :8081.
