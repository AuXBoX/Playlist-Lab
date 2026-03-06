' Playlist Lab Server - Tray App Launcher
' Launches the PowerShell tray app without showing a console window

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strPowerShellScript = strScriptDir & "\tray-app.ps1"

' Launch PowerShell script hidden
objShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & strPowerShellScript & """", 0, False

Set objShell = Nothing
Set objFSO = Nothing
