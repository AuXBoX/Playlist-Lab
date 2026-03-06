# Tray App Port Management

## Overview

The tray app now automatically detects the server's port and allows you to change it from the menu. This ensures the tray app always monitors the correct port, even if you change it.

## Features

### 1. Auto-Detect Port

The tray app automatically detects the server's port by:

1. **Reading `.env` file** - Checks `apps/server/.env` for `PORT=` setting
2. **Reading `package.json`** - Checks server's package.json for port config
3. **Using default** - Falls back to port 3001 if not found

**When it runs:**
- On tray app startup
- When "Auto-Detect Port" is enabled in menu
- After toggling auto-detect on

### 2. Manual Port Configuration

You can manually set the port from the tray menu:

1. Right-click tray icon
2. Click "Change Port..."
3. Enter new port number (1-65535)
4. Press Enter

**What happens:**
- Config file is updated (`tray-config.json`)
- Server's `.env` file is updated with new port
- Auto-detect is disabled (manual override)
- Menu is updated to show new port
- You're prompted to restart the server

### 3. Port Display in Menu

The tray menu shows the current port:
```
Server Port: 3001
```

This is always visible so you know which port is being monitored.

### 4. Auto-Detect Toggle

You can enable/disable auto-detect from the menu:

**When enabled (✓):**
- Port is automatically detected on startup
- Port changes in `.env` are picked up
- Manual port changes disable this

**When disabled:**
- Uses manually configured port
- Ignores `.env` file changes
- Useful if you want to force a specific port

## Configuration File

The tray app stores its config in `tray-config.json`:

```json
{
  "port": 3001,
  "autoDetectPort": true
}
```

**Location:** Same directory as tray app (installation directory)

**Fields:**
- `port` - Current port number
- `autoDetectPort` - Whether to auto-detect on startup

## Usage Scenarios

### Scenario 1: Server Running on Different Port

**Problem:** Server is on port 3001 but tray shows "Stopped"

**Solution:**
1. Right-click tray icon
2. Click "Change Port..."
3. Enter `3001`
4. Press Enter
5. Tray will now monitor port 3001

### Scenario 2: Changed Port in .env

**Problem:** Changed `PORT=3002` in `.env` but tray still checks 3001

**Solution:**
1. Right-click tray icon
2. Click "Auto-Detect Port" (enable it)
3. Tray will detect new port from `.env`
4. Restart server if needed

### Scenario 3: Multiple Servers

**Problem:** Running multiple instances on different ports

**Solution:**
1. Disable "Auto-Detect Port"
2. Manually set port for each tray instance
3. Each tray monitors its specific port

### Scenario 4: Port Conflict

**Problem:** Port 3001 is already in use

**Solution:**
1. Right-click tray icon
2. Click "Change Port..."
3. Enter available port (e.g., `3002`)
4. Click "Restart Server" from menu
5. Server starts on new port

## Server Status Checking

The tray app checks server status every 5 seconds:

1. **Health endpoint** - Tries `http://localhost:{port}/health`
2. **Root endpoint** - Falls back to `http://localhost:{port}/`
3. **Updates icon** - Green (running) or Red (stopped)
4. **Shows uptime** - Displays in tooltip if available

**Timeout:** 3 seconds for health, 2 seconds for root

## Menu Structure

```
🟢 Playlist Lab - Running

├─ Open Playlist Lab
├─ Server Status
├─ ───────────────
├─ Start Server
├─ Stop Server
├─ Restart Server
├─ ───────────────
├─ Server Port: 3001
├─ Change Port...
├─ ✓ Auto-Detect Port
├─ ───────────────
├─ View Logs
├─ Settings
├─ ───────────────
└─ Exit
```

## Troubleshooting

### Tray Shows Wrong Port

**Check:**
1. Open `tray-config.json` in installation directory
2. Verify `port` value
3. Check if `autoDetectPort` is true/false
4. Manually change port from menu

### Auto-Detect Not Working

**Check:**
1. Verify `.env` file exists in `server/` directory
2. Check `.env` has `PORT=` line
3. Restart tray app
4. Enable "Auto-Detect Port" from menu

### Port Change Not Taking Effect

**Steps:**
1. Change port from tray menu
2. Verify `.env` file was updated
3. Restart server from tray menu
4. Check server logs for new port
5. Verify tray shows new port in menu

### Server Won't Start on New Port

**Check:**
1. Port is not already in use
2. Port number is valid (1-65535)
3. Firewall allows the port
4. `.env` file has correct PORT value
5. Try restarting tray app

## Command Line Override

You can still override the port via environment variable:

```bash
set PORT=3002
node tray-app.js
```

This takes precedence over config file.

## Integration with Server

The tray app passes the port to the server when starting:

```javascript
spawn(nodePath, [serverLauncherPath], {
  env: {
    ...process.env,
    PORT: SERVER_PORT.toString()
  }
});
```

This ensures the server starts on the correct port.

## Best Practices

1. **Use auto-detect** - Let the tray app detect the port automatically
2. **Update .env** - Change port in `.env` file, not just tray config
3. **Restart server** - Always restart after changing port
4. **Check status** - Verify tray shows "Running" after changes
5. **Test connection** - Click "Open Playlist Lab" to verify

## Files Modified

- `scripts/installers/windows/tray-app.js` - Main tray app with port management
- `tray-config.json` - Created automatically in installation directory
- `server/.env` - Updated when port is changed from menu

## Future Enhancements

Potential improvements:
- Port scanning to find available ports
- Multiple server profiles
- Remote server monitoring
- Port forwarding detection
- Network interface selection
