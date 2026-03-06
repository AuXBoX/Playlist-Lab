@echo off
REM Playlist Lab Server - Tray App Launcher
REM Starts tray-app.js via bundled Node.js with no console window

set "SCRIPT_DIR=%~dp0"

REM Write a temporary VBScript to launch node silently (no console window)
set "VBS=%TEMP%\playlist-lab-start.vbs"
(
  echo Set sh = CreateObject^("WScript.Shell"^)
  echo sh.Run Chr^(34^) ^& "%SCRIPT_DIR%nodejs\node.exe" ^& Chr^(34^) ^& " " ^& Chr^(34^) ^& "%SCRIPT_DIR%tray-app.js" ^& Chr^(34^), 0, False
) > "%VBS%"

wscript //nologo "%VBS%"
