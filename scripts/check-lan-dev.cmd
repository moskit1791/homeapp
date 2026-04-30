@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-lan-dev.ps1" %*
exit /b %ERRORLEVEL%
