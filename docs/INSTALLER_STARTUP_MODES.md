# Playlist Lab Server - Startup Modes

The Windows installer for Playlist Lab Server offers three startup modes to suit different use cases.

## Startup Mode Options

During installation, you'll be asked to choose how the server should start:

### 1. Manual Start (Default)
- **Best for**: Testing, development, or occasional use
- **Behavior**: Server only runs when you manually start it
- **How to start**: Use the "Start Server" shortcut in the Start Menu
- **How to stop**: Use the "Stop Server" shortcut or close the console window

### 2. Start on Login
- **Best for**: Personal use on a workstation
- **Behavior**: Server automatically starts when you log in to Windows
- **How to start**: Automatic on login, or use "Start Server" shortcut
- **How to stop**: Use the "Stop Server" shortcut
- **Technical**: Adds a startup entry to Windows Task Scheduler for your user account

### 3. Windows Service
- **Best for**: Production servers, always-on systems, multi-user environments
- **Behavior**: Server runs as a background Windows service (always running)
- **How to start**: Automatic on system boot
- **How to stop**: Use Windows Services manager or "Stop Server" shortcut
- **Technical**: Installs as a Windows service named "PlaylistLabServer"
- **Requires**: Administrator privileges

## Changing Startup Mode After Installation

You can change the startup mode after installation using the management scripts:

### Switch to Manual Start
```batch
cd "C:\Program Files\Playlist Lab Server"
node startup-manager.js disable
node service-manager.js stop
node service-manager.js uninstall
```

### Switch to Start on Login
```batch
cd "C:\Program Files\Playlist Lab Server"
node service-manager.js stop
node service-manager.js uninstall
node startup-manager.js enable
```

### Switch to Windows Service
```batch
cd "C:\Program Files\Playlist Lab Server"
node startup-manager.js disable
node service-manager.js install
node service-manager.js start
```

## Management Scripts

The installer includes three management scripts:

### server-launcher.js
Starts the server in the foreground (console window). Used for manual starts.

### startup-manager.js
Manages Windows startup configuration (Start on Login mode).

Commands:
- `node startup-manager.js enable` - Enable start on login
- `node startup-manager.js disable` - Disable start on login
- `node startup-manager.js status` - Check current status

### service-manager.js
Manages Windows service installation (Windows Service mode).

Commands:
- `node service-manager.js install` - Install as Windows service
- `node service-manager.js uninstall` - Remove Windows service
- `node service-manager.js start` - Start the service
- `node service-manager.js stop` - Stop the service
- `node service-manager.js restart` - Restart the service
- `node service-manager.js status` - Check service status

## Troubleshooting

### Server won't start on login
1. Check Task Scheduler for "PlaylistLabServer" task
2. Verify the task is enabled
3. Check task history for errors
4. Re-run: `node startup-manager.js enable`

### Service won't start
1. Open Windows Services (services.msc)
2. Find "PlaylistLabServer" service
3. Check service status and startup type
4. View service properties for error messages
5. Check Windows Event Viewer for service errors

### Port already in use
If you see "Port 3001 already in use":
1. Another instance may be running
2. Stop all instances: `node service-manager.js stop` and use "Stop Server" shortcut
3. Check for other applications using port 3001
4. Change the port in `.env` file if needed

## Uninstallation

The uninstaller automatically:
- Stops any running server processes
- Removes the Windows service (if installed)
- Removes startup configuration (if enabled)
- Removes all installed files

Your data (database, logs) in `%APPDATA%\PlaylistLabServer` is preserved by default.
