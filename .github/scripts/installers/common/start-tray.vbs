Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Build the command to run node.exe with tray-app.js
strNodePath = strScriptPath & "\nodejs\node.exe"
strTrayApp = strScriptPath & "\tray-app.js"

' Run the command hidden (0 = hidden window, False = don't wait)
objShell.Run """" & strNodePath & """ """ & strTrayApp & """", 0, False

Set objShell = Nothing
Set objFSO = Nothing
