; Inno Setup Script for Playlist Lab Server
; Web-based multi-user server (v1.1.2)

#ifndef MyAppSourceDir
  #define MyAppSourceDir "..\..\..\.."
#endif

#define MyAppName "Playlist Lab Server"
#define MyAppVersion "1.1.2"
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
Source: "{#MyAppSourceDir}\apps\server\node_modules\*"; DestDir: "{app}\server\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; Web app files
Source: "{#MyAppSourceDir}\apps\web\dist\*"; DestDir: "{app}\web\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; Shared package
Source: "{#MyAppSourceDir}\packages\shared\dist\*"; DestDir: "{app}\packages\shared\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MyAppSourceDir}\packages\shared\package.json"; DestDir: "{app}\packages\shared"; Flags: ignoreversion

; Tray app
Source: "{#SourcePath}\..\common\tray-app.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourcePath}\..\common\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourcePath}\..\common\server-launcher.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourcePath}\..\common\server-launcher.js"; DestDir: "{app}"; Flags: ignoreversion

; Startup manager
Source: "{#SourcePath}\startup-manager.js"; DestDir: "{app}"; Flags: ignoreversion

; Configuration
Source: "{#MyAppSourceDir}\apps\server\.env.example"; DestDir: "{app}\server"; DestName: ".env"; Flags: onlyifdoesntexist

[Tasks]
Name: "startupmode"; Description: "Choose how to start Playlist Lab Server:"; GroupDescription: "Startup Configuration:"; Flags: exclusive
Name: "startupmode\autostart"; Description: "Start automatically on login (recommended)"; GroupDescription: "Startup Configuration:"; Flags: exclusive
Name: "startupmode\service"; Description: "Run as Windows service (always running)"; GroupDescription: "Startup Configuration:"; Flags: exclusive unchecked
Name: "startupmode\manual"; Description: "Manual start only"; GroupDescription: "Startup Configuration:"; Flags: exclusive unchecked
Name: "launchnow"; Description: "Launch Playlist Lab Server now"; GroupDescription: "Additional Options:"

[Icons]
Name: "{group}\Playlist Lab Server"; Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\tray-app.js"""; WorkingDir: "{app}"; IconFilename: "{app}\server\dist\favicon.ico"
Name: "{group}\Open Playlist Lab"; Filename: "http://localhost:3001"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Playlist Lab"; Filename: "http://localhost:3001"

[Run]
Filename: "{app}\nodejs\npm.cmd"; Parameters: "install --production --no-optional"; WorkingDir: "{app}\server"; StatusMsg: "Installing server dependencies..."; Flags: runhidden waituntilterminated
Filename: "{app}\nodejs\npm.cmd"; Parameters: "install --production --no-optional"; WorkingDir: "{app}"; StatusMsg: "Installing tray app dependencies..."; Flags: runhidden waituntilterminated
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\startup-manager.js"" --mode autostart"; WorkingDir: "{app}"; StatusMsg: "Configuring startup..."; Flags: runhidden waituntilterminated; Tasks: startupmode\autostart
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\startup-manager.js"" --mode service"; WorkingDir: "{app}"; StatusMsg: "Configuring service..."; Flags: runhidden waituntilterminated; Tasks: startupmode\service
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\startup-manager.js"" --mode manual"; WorkingDir: "{app}"; StatusMsg: "Configuring manual start..."; Flags: runhidden waituntilterminated; Tasks: startupmode\manual
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\tray-app.js"""; WorkingDir: "{app}"; StatusMsg: "Starting Playlist Lab Server..."; Flags: runhidden nowait; Tasks: launchnow
Filename: "http://localhost:3001"; Description: "Open Playlist Lab in browser"; Flags: shellexec postinstall skipifsilent nowait; Tasks: launchnow

[UninstallRun]
Filename: "{app}\nodejs\node.exe"; Parameters: """{app}\startup-manager.js"" --mode remove"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated
