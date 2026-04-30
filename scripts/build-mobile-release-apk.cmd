@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-mobile-release-apk.ps1" %*
