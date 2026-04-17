; Inno Setup Script for Playlist Lab Server
; Web-based multi-user server

#ifndef MyAppSourceDir
  #define MyAppSourceDir "..\..\..\.."
#endif

; Version will be passed as a command-line parameter /DMyAppVersion=x.x.x
#ifndef MyAppVersion
  #define MyAppVersion "1.1.5"
#endif

#define MyAppName "Playlist Lab Server"
#define MyAppPublisher "Playlist Lab"
#define MyAppURL "https://github.com/AuXBoX/Playlist-Lab"

[Setup]
AppId={{8F9A2B3C-4D5E-6F7A-8B9C-0D1E2F3A4B5C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputBaseFilename=PlaylistLabServer-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Node.js runtime
Source: "{#MyAppSourceDir}\release\windows\nodejs\*"; DestDir: "{app}\nodejs"; Flags: ignoreversion recursesubdirs createallsubdirs

; Server files
Source: "{#MyAppSourceDir}\apps\server\dist\*"; DestDir: "{app}\server\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MyAppSourceDir}\apps\server\package.json"; DestDir: "{app}\server"; Flags: ignoreversion
Source: "{#MyAppSourceDir}\apps\server\node_modules\*"; DestDir: "{app}\server\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

; Web app files
Source: "{#MyAppSourceDir}\apps\web\dist\*"; DestDir: "{app}\web\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; Tray app
Source: "{#SourcePath}\..\common\tray-app.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourcePath}\..\common\auto-updater.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourcePath}\..\common\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourcePath}\..\common\server-launcher.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourcePath}\..\common\start-tray.vbs"; DestDir: "{app}"; Flags: ignoreversion

; Tray icons
Source: "{#SourcePath}\..\common\icons\*.png"; DestDir: "{app}\icons"; Flags: ignoreversion

; Startup manager
Source: "{#SourcePath}\startup-manager.js"; DestDir: "{app}"; Flags: ignoreversion

; Server start script
Source: "{#SourcePath}\start-server.bat"; DestDir: "{app}"; Flags: ignoreversion

; Configuration (use persistent location in user's AppData)
Source: "{#MyAppSourceDir}\apps\server\.env.example"; DestDir: "{userappdata}\Playlist Lab"; DestName: ".env"; Flags: onlyifdoesntexist uninsneveruninstall

[Dirs]
; Create persistent data directory in user's AppData (never deleted on uninstall)
Name: "{userappdata}\Playlist Lab\data"; Flags: uninsneveruninstall
Name: "{userappdata}\Playlist Lab\logs"; Flags: uninsneveruninstall

[Tasks]
Name: "startupmode"; Description: "Choose how to start Playlist Lab Server:"; GroupDescription: "Startup Configuration:"; Flags: exclusive
Name: "startupmode\autostart"; Description: "Start automatically on login (recommended)"; GroupDescription: "Startup Configuration:"; Flags: exclusive
Name: "startupmode\service"; Description: "Run as Windows service (always running)"; GroupDescription: "Startup Configuration:"; Flags: exclusive unchecked
Name: "startupmode\manual"; Description: "Manual start only"; GroupDescription: "Startup Configuration:"; Flags: exclusive unchecked
Name: "launchnow"; Description: "Launch Playlist Lab Server now"; GroupDescription: "Additional Options:"

[Icons]
Name: "{group}\Playlist Lab Server"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-tray.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\icons\tray-icon.png"; Comment: "Launch Playlist Lab with system tray"
Name: "{group}\Start Server Only"; Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\server-launcher.js"""; WorkingDir: "{app}"; IconFilename: "{app}\icons\tray-icon.png"; Comment: "Start the Playlist Lab server without tray app"
Name: "{group}\Open Playlist Lab"; Filename: "http://localhost:3001"; IconFilename: "{app}\icons\tray-icon.png"; Comment: "Open Playlist Lab in your browser"
Name: "{group}\Server Logs"; Filename: "{userappdata}\Playlist Lab\logs"; Comment: "View server log files"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Playlist Lab"; Filename: "http://localhost:3001"; IconFilename: "{app}\icons\tray-icon.png"

[Run]
Filename: "{app}\nodejs\npm.cmd"; Parameters: "install --production --no-optional"; WorkingDir: "{app}"; StatusMsg: "Installing tray app dependencies..."; Flags: runhidden waituntilterminated
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\startup-manager.js"" --mode autostart"; WorkingDir: "{app}"; StatusMsg: "Configuring startup..."; Flags: runhidden waituntilterminated; Tasks: startupmode\autostart
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\startup-manager.js"" --mode service"; WorkingDir: "{app}"; StatusMsg: "Configuring service..."; Flags: runhidden waituntilterminated; Tasks: startupmode\service
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\startup-manager.js"" --mode manual"; WorkingDir: "{app}"; StatusMsg: "Configuring manual start..."; Flags: runhidden waituntilterminated; Tasks: startupmode\manual
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\tray-app.js"""; WorkingDir: "{app}"; StatusMsg: "Starting Playlist Lab Server..."; Flags: nowait; Tasks: launchnow
Filename: "http://localhost:3001"; Description: "Open Playlist Lab in browser"; Flags: shellexec postinstall skipifsilent nowait; Tasks: launchnow

[UninstallRun]
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\startup-manager.js"" --mode remove"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated

[Code]
var
  WasRunningBeforeUpdate: Boolean;

procedure KillProcessesByName(ProcessName: String);
var
  ResultCode: Integer;
  Attempts: Integer;
begin
  Log('Attempting to kill process: ' + ProcessName);
  
  // Try multiple times to ensure all instances are killed
  for Attempts := 1 to 3 do
  begin
    Exec('taskkill', '/F /IM ' + ProcessName + ' /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1000); // Wait between attempts
    
    // Check if any instances are still running
    Exec('tasklist', '/FI "IMAGENAME eq ' + ProcessName + '" /NH', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    if ResultCode <> 0 then
    begin
      Log('All ' + ProcessName + ' processes killed after ' + IntToStr(Attempts) + ' attempt(s)');
      Exit;
    end;
  end;
  
  Log('Warning: Some ' + ProcessName + ' processes may still be running');
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  PlaylistLabDir: String;
begin
  Result := '';
  WasRunningBeforeUpdate := False;
  
  // Check if this is an update (installation directory already exists)
  if DirExists(ExpandConstant('{app}')) then
  begin
    Log('Existing installation detected - stopping all processes...');
    
    // Check if tray app was running before we kill it
    Exec('tasklist', '/FI "IMAGENAME eq node.exe" /NH', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    if ResultCode = 0 then
      WasRunningBeforeUpdate := True;
    
    // Kill all Node.js processes (server and tray app)
    KillProcessesByName('node.exe');
    
    // Kill VBScript processes (old tray launcher)
    KillProcessesByName('wscript.exe');
    
    // Wait for processes to fully terminate and release file locks
    Sleep(3000);
    
    // Ensure the @playlist-lab directory exists and is writable
    PlaylistLabDir := ExpandConstant('{app}\server\node_modules\@playlist-lab');
    if DirExists(PlaylistLabDir) then
    begin
      Log('Removing existing @playlist-lab directory...');
      DelTree(PlaylistLabDir, True, True, True);
      Sleep(500);
    end;
    
    // Create the directory structure
    Log('Creating @playlist-lab directory structure...');
    ForceDirectories(PlaylistLabDir);
    
    Log('All processes stopped and directories prepared, ready to update files');
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  StartupShortcut: String;
begin
  if CurStep = ssPostInstall then
  begin
    // Check if there's a startup shortcut
    StartupShortcut := ExpandConstant('{userstartup}\PlaylistLabServer.lnk');
    
    // Only restart tray app if it was running before AND there's no startup shortcut
    // If there's a startup shortcut, Windows will start it automatically
    if WasRunningBeforeUpdate and not FileExists(StartupShortcut) then
    begin
      Log('Restarting tray app after update (no startup shortcut found)...');
      Sleep(3000); // Wait longer for files to settle and old processes to fully terminate
      
      // Use Node.js to start tray app directly (not VBScript)
      Exec(ExpandConstant('{app}\nodejs\node.exe'), ExpandConstant('"{app}\tray-app.js"'), ExpandConstant('{app}'), SW_HIDE, ewNoWait, ResultCode);
    end
    else if FileExists(StartupShortcut) then
    begin
      Log('Startup shortcut exists - not restarting tray app (will start on next login)');
    end;
  end;
end;
