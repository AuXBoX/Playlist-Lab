; Inno Setup Script for Playlist Lab Server
; Web-based multi-user server (v2.0.0)

#define MyAppName "Playlist Lab Server"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "Playlist Lab"
#define MyAppURL "https://github.com/yourusername/playlist-lab"

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
OutputDir=..\release
OutputBaseFilename=PlaylistLabServer-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"



[Files]
; Node.js portable (relative to setup-temp.iss location in scripts/temp/)
Source: "node-v20.11.0-win-x64\*"; DestDir: "{app}\nodejs"; Flags: ignoreversion recursesubdirs createallsubdirs

; Server files (relative to scripts/temp/, go up to project root)
Source: "..\..\apps\server\dist\*"; DestDir: "{app}\server\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\apps\server\package.json"; DestDir: "{app}\server"; Flags: ignoreversion
Source: "..\..\apps\server\package-lock.json"; DestDir: "{app}\server"; Flags: ignoreversion skipifsourcedoesntexist

; Web app files
Source: "..\..\apps\web\dist\*"; DestDir: "{app}\web\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; Shared package
Source: "..\..\packages\shared\dist\*"; DestDir: "{app}\packages\shared\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\packages\shared\package.json"; DestDir: "{app}\packages\shared"; Flags: ignoreversion

; Management scripts
Source: "..\installers\windows\server-launcher.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\installers\windows\service-manager.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\installers\windows\startup-manager.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\installers\common\tray-app.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\installers\common\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\installers\common\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
Source: "..\installers\windows\start-tray-app.bat"; DestDir: "{app}"; Flags: ignoreversion

; Root package.json for workspace structure
Source: "..\..\package.json"; DestDir: "{app}"; Flags: ignoreversion

; Configuration
Source: "..\..\apps\server\.env.example"; DestDir: "{app}\server"; DestName: ".env"; Flags: onlyifdoesntexist

; Documentation
Source: "..\..\docs\SERVER_README.md"; DestDir: "{app}"; DestName: "README.md"; Flags: ignoreversion isreadme
Source: "..\..\docs\WINDOWS_INSTALLER_GUIDE.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\USER_GUIDE.md"; DestDir: "{app}\docs"; Flags: ignoreversion

[Icons]
Name: "{group}\Playlist Lab"; Filename: "{app}\start-tray-app.bat"; IconFilename: "{sys}\shell32.dll"; IconIndex: 14; Comment: "Open Playlist Lab Server Tray"
Name: "{group}\Open Playlist Lab"; Filename: "http://localhost:3001"; IconFilename: "{sys}\shell32.dll"; IconIndex: 14
Name: "{group}\Start Server"; Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\server-launcher.js"""; WorkingDir: "{app}"; IconFilename: "{sys}\shell32.dll"; IconIndex: 1
Name: "{group}\Stop Server"; Filename: "taskkill"; Parameters: "/F /IM node.exe /FI ""WINDOWTITLE eq *playlist-lab*"""; IconFilename: "{sys}\shell32.dll"; IconIndex: 27
Name: "{group}\Server Logs"; Filename: "{userappdata}\PlaylistLabServer"
Name: "{group}\User Guide"; Filename: "{app}\docs\WINDOWS_INSTALLER_GUIDE.md"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Playlist Lab"; Filename: "{app}\start-tray-app.bat"; IconFilename: "{sys}\shell32.dll"; IconIndex: 14; Comment: "Playlist Lab Server"
Name: "{userstartup}\Playlist Lab"; Filename: "{app}\start-tray-app.bat"; IconFilename: "{sys}\shell32.dll"; IconIndex: 14; Comment: "Playlist Lab Server Tray App"; Check: IsStartOnLogin

[Run]
; Create node_modules directory structure for workspace package
Filename: "{cmd}"; Parameters: "/c if not exist ""{app}\server\node_modules\@playlist-lab"" mkdir ""{app}\server\node_modules\@playlist-lab"""; Flags: runhidden waituntilterminated
; Copy shared package to server's node_modules before npm install
Filename: "{cmd}"; Parameters: "/c xcopy /E /I /Y ""{app}\packages\shared"" ""{app}\server\node_modules\@playlist-lab\shared"""; Flags: runhidden waituntilterminated
; Install server dependencies
Filename: "{app}\nodejs\npm.cmd"; Parameters: "install --production --no-optional"; WorkingDir: "{app}\server"; StatusMsg: "Installing server dependencies (this may take a few minutes)..."; Flags: runhidden waituntilterminated
; Initialize the database
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\server\dist\database\init.js"""; WorkingDir: "{app}\server"; StatusMsg: "Initializing database..."; Flags: runhidden waituntilterminated
; Start the tray app
Filename: "{app}\start-tray-app.bat"; Description: "Start Playlist Lab Server tray application"; Flags: nowait postinstall skipifsilent
; Open browser
Filename: "http://localhost:3001"; Description: "Open Playlist Lab in browser"; Flags: shellexec postinstall skipifsilent

[Code]
var
  StartupModePage: TInputOptionWizardPage;
  StartupMode: Integer; // 0 = Manual, 1 = Startup, 2 = Service

function IsStartOnLogin(): Boolean;
begin
  Result := StartupModePage.SelectedValueIndex = 1;
end;

procedure InitializeWizard;
begin
  // Create custom page for startup mode selection
  StartupModePage := CreateInputOptionPage(wpSelectDir,
    'Server Startup Mode', 'How would you like Playlist Lab Server to start?',
    'Choose how the server should run on your system. The tray application will be installed and configured based on your selection.',
    True, False);
  
  // Add radio button options
  StartupModePage.Add('Manual Start - Start the server manually when needed (tray app available in Start Menu)');
  StartupModePage.Add('Start on Login - Automatically start tray app when you log in to Windows');
  StartupModePage.Add('Windows Service - Run server as a background service (always running)');
  
  // Default to Start on Login
  StartupModePage.SelectedValueIndex := 1;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    StartupMode := StartupModePage.SelectedValueIndex;
    
    // Configure based on selected mode
    case StartupMode of
      0: begin
        // Manual Start - tray app available but not auto-started
        Log('Startup Mode: Manual');
      end;
      
      1: begin
        // Start on Login - add tray app to startup
        Log('Startup Mode: Start on Login');
        // Tray app shortcut already created in {userstartup} by [Icons] section
      end;
      
      2: begin
        // Windows Service
        Log('Startup Mode: Windows Service');
        Exec(ExpandConstant('{app}\nodejs\node.exe'), 
             ExpandConstant('"{app}\service-manager.js" install'), 
             ExpandConstant('{app}'), 
             SW_HIDE, ewWaitUntilTerminated, ResultCode);
        if ResultCode = 0 then
        begin
          // Start the service
          Exec(ExpandConstant('{app}\nodejs\node.exe'), 
               ExpandConstant('"{app}\service-manager.js" start'), 
               ExpandConstant('{app}'), 
               SW_HIDE, ewWaitUntilTerminated, ResultCode);
        end;
      end;
    end;
  end;
end;

function InitializeUninstall(): Boolean;
var
  ResultCode: Integer;
  AppDir: String;
begin
  Result := True;
  AppDir := ExpandConstant('{app}');
  
  // Step 1: Kill tray app - CRITICAL for file removal
  Log('Stopping tray application (CRITICAL)...');
  
  // Kill all PowerShell processes running tray-app.ps1 (most reliable method)
  Exec('powershell', '-Command "Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like ''*tray-app.ps1*'' } | Stop-Process -Force"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Kill wscript.exe (VBS launcher)
  Exec('taskkill', '/F /IM wscript.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Kill any remaining PowerShell with tray-app in window title
  Exec('taskkill', '/F /FI "IMAGENAME eq powershell.exe" /FI "WINDOWTITLE eq *tray-app*"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Wait for tray app to fully close
  Sleep(2000);
  
  // Step 2: Kill processes on port 3001
  Log('Killing processes on port 3001...');
  Exec('powershell', '-Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Step 3: Kill all node.exe processes from Playlist Lab Server directory
  Log('Killing Playlist Lab Server node processes...');
  Exec('powershell', '-Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like ''*Playlist Lab Server*'' } | Stop-Process -Force"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Step 4: Kill any node.exe processes with command line containing the app directory
  Exec('powershell', '-Command "Get-WmiObject Win32_Process -Filter \"name=''node.exe''\" | Where-Object { $_.CommandLine -like ''*' + AppDir + '*'' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Wait for processes to fully terminate
  Sleep(3000);
  
  // Step 5: Try to stop and remove service if it exists
  Log('Stopping Windows service...');
  Exec(ExpandConstant('{app}\nodejs\node.exe'), 
       ExpandConstant('"{app}\service-manager.js" stop'), 
       ExpandConstant('{app}'), 
       SW_HIDE, ewWaitUntilTerminated, ResultCode);
       
  Exec(ExpandConstant('{app}\nodejs\node.exe'), 
       ExpandConstant('"{app}\service-manager.js" uninstall'), 
       ExpandConstant('{app}'), 
       SW_HIDE, ewWaitUntilTerminated, ResultCode);
       
  // Step 6: Remove from startup
  Log('Removing from startup...');
  Exec(ExpandConstant('{app}\nodejs\node.exe'), 
       ExpandConstant('"{app}\startup-manager.js" disable'), 
       ExpandConstant('{app}'), 
       SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Final wait to ensure all file handles are released
  Sleep(2000);
  
  Log('Uninstall preparation complete');
end;

