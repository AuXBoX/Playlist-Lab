# Playlist Lab Server - Tray Application Guide

The Playlist Lab Server includes a system tray application that makes it easy to manage and access your server.

## Features

- **Visual Status Indicator**: Green icon when server is running, red when stopped
- **Quick Access**: Double-click the tray icon to open the web interface
- **Server Control**: Start, stop, and restart the server from the tray menu
- **Easy Access to Logs**: Open the logs folder with one click
- **Always Available**: Sits quietly in your system tray

## Starting the Tray App

### Automatic Start (Recommended)

If you selected "Start tray application on Windows login" during installation, the tray app will start automatically when you log in to Windows.

### Manual Start

1. **From Start Menu**:
   - Open Start Menu
   - Find "Playlist Lab"
   - Click "Playlist Lab" (the main icon)

2. **From Desktop**:
   - Double-click the "Playlist Lab" icon on your desktop

3. **From Installation Folder**:
   - Navigate to `C:\Program Files\Playlist Lab Server`
   - Double-click `start-tray.bat`

## Using the Tray App

### Tray Icon Status

- **Green Icon** 🟢 - Server is running and accessible
- **Red Icon** 🔴 - Server is stopped

### Double-Click Action

Double-click the tray icon to open the Playlist Lab web interface in your default browser.

### Right-Click Menu

Right-click the tray icon to access these options:

#### Open Playlist Lab
Opens the web interface in your browser (same as double-clicking).

#### Start Server
Starts the Playlist Lab Server if it's not running.
- Disabled when server is already running
- Takes a few seconds to start
- Icon will turn green when ready

#### Stop Server
Stops the Playlist Lab Server.
- Disabled when server is not running
- Stops all server processes
- Icon will turn red

#### Restart Server
Stops and then starts the server.
- Useful after configuration changes
- Useful if server becomes unresponsive
- Takes a few seconds to complete

#### View Logs
Opens the logs folder in File Explorer.
- Location: `%APPDATA%\PlaylistLabServer`
- Contains `server.log` and `server-error.log`
- Useful for troubleshooting

#### Exit
Closes the tray application.
- **Note**: This does NOT stop the server
- The server will continue running in the background
- You can restart the tray app anytime

## Balloon Notifications

The tray app shows balloon notifications for:
- When the tray app starts
- When the server starts or stops (optional)

## Troubleshooting

### Tray icon doesn't appear

1. **Check if it's running**:
   - Open Task Manager (Ctrl+Shift+Esc)
   - Look for "powershell.exe" running the tray script

2. **Check system tray settings**:
   - Right-click taskbar → Taskbar settings
   - Click "Select which icons appear on the taskbar"
   - Ensure "Playlist Lab" is enabled

3. **Restart the tray app**:
   - Close it from the tray menu (Exit)
   - Start it again from the Start Menu

### Can't start/stop server from tray

1. **Check permissions**:
   - The tray app needs permission to start/stop processes
   - Run as administrator if needed

2. **Check if server is running manually**:
   - If you started the server manually, the tray app might not detect it
   - Use "Restart Server" to sync the state

3. **Check logs**:
   - Use "View Logs" from the tray menu
   - Look for error messages in `server-error.log`

### Server status not updating

The tray app checks server status every 10 seconds. If the status seems wrong:

1. **Wait 10 seconds** for the next check
2. **Right-click and select "Restart Server"** to force a refresh
3. **Restart the tray app** if the issue persists

### Double-click doesn't open browser

1. **Check if server is running** (icon should be green)
2. **Try right-click → "Open Playlist Lab"**
3. **Manually open**: http://localhost:3001
4. **Check default browser** is set correctly in Windows

## Advanced Configuration

### Change Server URL

If you're using a custom port or domain:

1. **Edit the tray script**:
   - Location: `C:\Program Files\Playlist Lab Server\tray-app.ps1`
   - Find the line: `$serverUrl = "http://localhost:3001"`
   - Change to your URL: `$serverUrl = "https://playlist.yourdomain.com"`

2. **Restart the tray app**

### Disable Automatic Startup

If you don't want the tray app to start automatically:

1. **Open Startup folder**:
   - Press Win+R
   - Type: `shell:startup`
   - Press Enter

2. **Delete the shortcut**:
   - Find "Playlist Lab"
   - Delete it

3. **Or disable in Task Manager**:
   - Open Task Manager (Ctrl+Shift+Esc)
   - Go to "Startup" tab
   - Find "Playlist Lab"
   - Click "Disable"

### Run Multiple Instances

If you need to run multiple Playlist Lab servers:

1. **Install to different directories**
2. **Each will have its own tray app**
3. **Configure different ports** in each `.env` file
4. **Edit each tray script** to use the correct port

## Tips

1. **Keep it running**: The tray app uses minimal resources and provides quick access
2. **Use keyboard shortcuts**: Win+B to access system tray, then arrow keys to navigate
3. **Pin to taskbar**: Drag the tray icon to the taskbar for even quicker access
4. **Check status at a glance**: The color-coded icon shows server status instantly

## Uninstalling

When you uninstall Playlist Lab Server:
- The tray app will be removed
- The startup entry will be removed
- Any running tray app instances will continue until you exit them manually

To fully clean up:
1. **Exit the tray app** (right-click → Exit)
2. **Uninstall** Playlist Lab Server
3. **Delete logs** (optional): `%APPDATA%\PlaylistLabServer`

## Feedback

If you have suggestions for improving the tray app, please open an issue on GitHub!


## Port Detection and Configuration

### Auto Port Detection (New Feature)

The tray app now automatically detects which port your server is running on. This ensures the tray app always connects to the correct server, even if you change the port.

**How it works:**
- Scans common ports every 5 seconds (3001, 3000, 3002, 3003, 8080, 8000)
- Automatically updates when server is found
- Shows current port in tray tooltip and menu

**Tray tooltip example:**
```
🟢 Playlist Lab - Running (Port 3001) - 2h 15m
```

### Manual Port Configuration

If you need to set a specific port:

1. Right-click tray icon
2. Click "Server Port: XXXX"
3. Config file opens in Notepad
4. Change the `"port"` value
5. Save and restart tray app

**Config file location:** `C:\Program Files\Playlist Lab Server\tray-config.json`

**Example:**
```json
{
  "port": 3001,
  "autoDetectPort": true
}
```

### Toggle Auto-Detection

You can enable/disable automatic port detection:

1. Right-click tray icon
2. Click "Auto-detect Port"
3. ✓ appears when enabled

**When to disable auto-detection:**
- You know the exact port and want faster startup
- Running multiple servers and want to target a specific one
- Auto-detection is causing issues

### Updated Tray Menu

The tray menu now includes port configuration options:

```
🟢 Playlist Lab - Running (Port 3001)
├── Open Playlist Lab
├── Server Status
├── ───────────────
├── Start Server
├── Stop Server
├── Restart Server
├── ───────────────
├── Server Port: 3001          ← NEW: Click to configure
├── ✓ Auto-detect Port         ← NEW: Toggle auto-detection
├── ───────────────
├── View Logs
├── Settings
├── ───────────────
└── Exit
```

## Troubleshooting Port Issues

### Tray Shows "Stopped" But Server is Running

**Solution 1: Enable auto-detect**
1. Right-click tray icon
2. Click "Auto-detect Port" (should show ✓)
3. Wait 5 seconds for detection

**Solution 2: Manually set correct port**
1. Check what port server is using (look at server console or browser URL)
2. Right-click tray → "Server Port: XXXX"
3. Edit config file with correct port
4. Restart tray app

### Server on Different Port

If you changed the server port in the `.env` file:

1. The tray app will auto-detect the new port (if auto-detect is enabled)
2. Or manually update the tray config to match

**Server port location:** `C:\Program Files\Playlist Lab Server\server\.env`

### Multiple Servers Running

If you have multiple Playlist Lab servers:

1. Disable auto-detect on the tray app
2. Manually set the port for the specific server you want to monitor
3. Only one tray app can run at a time

## Advanced Configuration

For detailed information about port detection and configuration, see:
- [TRAY_APP_PORT_DETECTION.md](./TRAY_APP_PORT_DETECTION.md) - Complete port detection guide
- [WINDOWS_INSTALLER_GUIDE.md](./WINDOWS_INSTALLER_GUIDE.md) - Installation and setup

## Common Ports

The tray app checks these ports (in order):
1. Your configured port (from config file)
2. 3001 (default)
3. 3000
4. 3002
5. 3003
6. 8080
7. 8000

If your server uses a different port, you'll need to configure it manually.
