; Inno Setup Script for Playlist Lab Server
; Web-based multi-user server (v2.0.0)

#define MyAppName "Playlist Lab Server"
#define MyAppVersion "2.0.0"
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
; Server files (paths relative to project root, passed via /D parameter)
Source: "{#SourcePath}\..\..\..\apps\server\dist\*"; DestDir: "{app}\server\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourcePath}\..\..\..\apps\server\package.json"; DestDir: "{app}\server"; Flags: ignoreversion
Source: "{#SourcePath}\..\..\..\apps\server\node_modules\*"; DestDir: "{app}\server\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; Web app files
Source: "{#SourcePath}\..\..\..\apps\web\dist\*"; DestDir: "{app}\web\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; Shared package
Source: "{#SourcePath}\..\..\..\packages\shared\dist\*"; DestDir: "{app}\packages\shared\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourcePath}\..\..\..\packages\shared\package.json"; DestDir: "{app}\packages\shared"; Flags: ignoreversion

; Tray app
Source: "{#SourcePath}\..\common\tray-app.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourcePath}\..\common\package.json"; DestDir: "{app}"; Flags: ignoreversion

; Configuration
Source: "{#SourcePath}\..\..\..\apps\server\.env.example"; DestDir: "{app}\server"; DestName: ".env"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\Open Playlist Lab"; Filename: "http://localhost:3001"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Playlist Lab"; Filename: "http://localhost:3001"

[Run]
Filename: "{app}\nodejs\npm.cmd"; Parameters: "install --production --no-optional"; WorkingDir: "{app}\server"; StatusMsg: "Installing server dependencies..."; Flags: runhidden waituntilterminated
Filename: "{app}\nodejs\npm.cmd"; Parameters: "install --production --no-optional"; WorkingDir: "{app}"; StatusMsg: "Installing tray app dependencies..."; Flags: runhidden waituntilterminated
Filename: "http://localhost:3001"; Description: "Open Playlist Lab in browser"; Flags: shellexec postinstall skipifsilent
