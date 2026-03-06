@echo off
REM Playlist Lab GitHub Manager - Double-click to run!
REM This launches the interactive PowerShell script

title Playlist Lab GitHub Manager

REM Get the directory where this batch file is located (scripts folder)
set SCRIPT_DIR=%~dp0

REM Run PowerShell script in the same directory with NoExit to keep window open
powershell.exe -ExecutionPolicy Bypass -NoExit -NoProfile -Command "& '%SCRIPT_DIR%github-manager.ps1'"
