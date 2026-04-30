@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0android-debug-smoke.ps1" %*
exit /b %ERRORLEVEL%
