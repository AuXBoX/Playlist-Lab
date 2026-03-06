@echo off
REM Playlist Lab Server - Tray App Launcher
REM Starts the PowerShell tray app without showing a console window

set SCRIPT_DIR=%~dp0
powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "%SCRIPT_DIR%tray-app.ps1"
