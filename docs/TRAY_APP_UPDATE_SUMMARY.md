# Tray App Update Summary

## What Changed

The tray app has been completely rewritten with intelligent port detection and configuration features.

## New Features

### 1. Automatic Port Detection ✨

The tray app now automatically finds which port your server is running on.

**Benefits:**
- No more "Server Stopped" when it's actually running on a different port
- Automatically adapts if you change the server port
- Checks multiple common ports (3001, 3000, 3002, 3003, 8080, 8000)
- Updates every 5 seconds

**How it works:**
```
1. Tray app starts
2. Checks configured port first (3001 by default)
3. If not found, scans other common ports
4. When server found, updates config automatically
5. Shows current port in tooltip and menu
```

### 2. Manual Port Configuration 🔧

You can now change the server port directly from the tray menu.

**How to use:**
1. Right-click tray icon
2. Click "Server Port: XXXX"
3. Config file opens in Notepad
4. Change `"port"` value
5. Save and restart tray app

**Config file:** `C:\Program Files\Playlist Lab Server\tray-config.json`

### 3. Toggle Auto-Detection ⚡

Enable/disable automatic port scanning with one click.

**How to use:**
1. Right-click tray icon
2. Click "Auto-detect Port"
3. ✓ shows when enabled

**When to disable:**
- You know the exact port (faster startup)
- Running multiple servers (target specific one)
- Auto-detection causing issues

### 4. Enhanced Status Display 📊

The tray now shows more detailed information:

**Tooltip format:**
```
🟢 Playlist Lab - Running (Port 3001) - 2h 15m
```

Shows:
- Status (Running/Stopped)
- Current port number
- Server uptime

### 5. Updated Menu 📋

New menu items for port management:

```
🟢 Playlist Lab - Running (Port 3001)
├── Open Playlist Lab
├── Server Status
├── ───────────────
├── Start Server
├── Stop Server
├── Restart Server
├── ───────────────
├── Server Port: 3001          ← NEW
├── ✓ Auto-detect Port         ← NEW
├── ───────────────
├── View Logs
├── Settings
├── ───────────────
└── Exit
```

## Configuration File

**Location:** `C:\Program Files\Playlist Lab Server\tray-config.json`

**Format:**
```json
{
  "port": 3001,
  "autoDetectPort": true
}
```

**Fields:**
- `port`: The port to check/use (default: 3001)
- `autoDetectPort`: Enable auto-detection (default: true)

**Auto-created:** File is created automatically on first run with default values.

## How Port Detection Works

### Detection Algorithm

```
1. Load config (or create with defaults)
2. Build port list:
   - Configured port (first priority)
   - Common ports (3001, 3000, 3002, 3003, 8080, 8000)
3. Check each port:
   - Try GET /health endpoint (1 second timeout)
   - If successful → server found!
   - If failed → try next port
4. Update config when server found
5. Repeat every 5 seconds
```

### Health Check Endpoints

The tray checks these endpoints:
1. `GET http://localhost:{port}/health` (primary)
2. `GET http://localhost:{port}/` (fallback)

Both must return HTTP 200 or 304 to be considered "running".

## Use Cases

### Use Case 1: Default Setup

**Scenario:** Fresh install, server on port 3001

**What happens:**
1. Tray starts with default config (port 3001, auto-detect on)
2. Checks port 3001 → server found!
3. Shows "Running (Port 3001)"
4. Everything works automatically

### Use Case 2: Changed Server Port

**Scenario:** You changed server to port 3000

**What happens:**
1. Tray checks port 3001 → not found
2. Auto-detect scans other ports
3. Finds server on port 3000
4. Updates config to port 3000
5. Shows "Running (Port 3000)"
6. Future checks start with port 3000

### Use Case 3: Multiple Servers

**Scenario:** Running multiple Playlist Lab servers

**What to do:**
1. Disable auto-detect on tray app
2. Manually set port for specific server
3. Tray only monitors that server

### Use Case 4: Custom Port

**Scenario:** Server on port 8080

**What to do:**
1. Right-click tray → "Server Port: 3001"
2. Change to `"port": 8080`
3. Save and restart tray
4. Or just enable auto-detect and wait 5 seconds

## Troubleshooting

### Problem: Tray shows "Stopped" but server is running

**Diagnosis:**
- Server is on different port than tray is checking
- Auto-detect is disabled
- Firewall blocking health check

**Solutions:**
1. Enable auto-detect (right-click → "Auto-detect Port")
2. Wait 5 seconds for detection
3. Or manually set correct port

### Problem: Wrong server detected

**Diagnosis:**
- Multiple servers running
- Auto-detect found wrong one

**Solutions:**
1. Disable auto-detect
2. Manually set correct port
3. Stop other server instances

### Problem: Port change not taking effect

**Diagnosis:**
- Config file not saved
- Tray app not restarted

**Solutions:**
1. Verify config file saved correctly
2. Exit tray app (right-click → Exit)
3. Start tray app again

### Problem: Can't access server from browser

**Diagnosis:**
- Server not actually running
- Wrong port in browser URL
- Firewall blocking

**Solutions:**
1. Check tray status (should be green)
2. Check tooltip for correct port
3. Use URL shown in tooltip
4. Check firewall settings

## Migration from Old Tray App

### What's Different

**Old tray app:**
- Fixed port (3000 or 3001)
- No auto-detection
- No port configuration

**New tray app:**
- Auto-detects port
- Configurable port
- Shows current port
- Adapts to changes

### Upgrading

**Automatic:**
- New installer includes updated tray app
- Config file created automatically
- No manual steps needed

**Manual:**
1. Replace `tray-app.js` with new version
2. Restart tray app
3. Config file created automatically

## Best Practices

1. **Keep auto-detect enabled** - Most reliable for typical use
2. **Check tray tooltip** - Shows current port and status
3. **One server instance** - Avoid running multiple servers
4. **Use standard ports** - 3000, 3001, 8080 are commonly allowed
5. **Restart after changes** - Always restart tray after config changes

## Documentation

- **TRAY_APP_GUIDE.md** - Complete tray app guide
- **TRAY_APP_PORT_DETECTION.md** - Detailed port detection guide
- **WINDOWS_INSTALLER_GUIDE.md** - Installation guide

## Technical Details

**File:** `scripts/installers/windows/tray-app.js`

**Dependencies:**
- `systray` - System tray integration
- `http` - Health check requests
- `fs` - Config file management

**Config persistence:**
- Saved to `tray-config.json` in install directory
- Automatically created on first run
- Updated when port detected
- Survives tray app restarts

**Performance:**
- Health checks every 5 seconds
- 1 second timeout per port check
- Minimal CPU usage
- No impact on server performance

## Summary

The updated tray app ensures you're always connected to the correct server port, whether you're using the default configuration or a custom setup. Auto-detection makes it "just work" for most users, while manual configuration provides flexibility for advanced scenarios.

**Key improvements:**
- ✅ Automatic port detection
- ✅ Manual port configuration
- ✅ Toggle auto-detection
- ✅ Enhanced status display
- ✅ Better error handling
- ✅ Persistent configuration
