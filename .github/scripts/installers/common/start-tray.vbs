' VBScript launcher for Playlist Lab Server tray app
' Launches the tray app without showing a console window

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Path to Node.js and tray app
strNodePath = strScriptDir & "\nodejs\node.exe"
strTrayApp = strScriptDir & "\tray-app.js"

' Check if files exist
If Not objFSO.FileExists(strNodePath) Then
    MsgBox "Node.js not found at: " & strNodePath, vbCritical, "Playlist Lab Server"
    WScript.Quit 1
End If

If Not objFSO.FileExists(strTrayApp) Then
    MsgBox "Tray app not found at: " & strTrayApp, vbCritical, "Playlist Lab Server"
    WScript.Quit 1
End If

' Set environment variable for install directory
objShell.Environment("Process")("INSTALL_DIR") = strScriptDir

' Launch the tray app without showing a window
' 0 = hide window, False = don't wait for completion
objShell.Run """" & strNodePath & """ """ & strTrayApp & """", 0, False

WScript.Quit 0
