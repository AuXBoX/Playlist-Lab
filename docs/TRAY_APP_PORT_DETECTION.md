# Tray App Port Detection

## Overview

The Playlist Lab Server tray app now includes intelligent port detection and configuration features to ensure it always connects to the correct server port.

## Features

### 1. Auto-Detect Port (Default: Enabled)

The tray app automatically scans common ports to find where the server is running:

**Ports checked (in order):**
1. Currently configured port (from config)
2. 3001 (default)
3. 3000
4. 3002
5. 3003
6. 8080
7. 8000

**How it works:**
- Checks each port every 5 seconds
- When server is found, updates the configuration automatically
- Shows current port in the tray tooltip
- Updates menu to reflect detected port

### 2. Manual Port Configuration

You can manually set the server port if auto-detection doesn't work:

**Method 1: Via Tray Menu**
1. Right-click tray icon
2. Click "Server Port: XXXX"
3. Config file opens in Notepad
4. Change the `"port"` value
5. Save and restart tray app

**Method 2: Edit Config File**
1. Navigate to: `C:\Program Files\Playlist Lab Server\tray-config.json`
2. Edit the file:
   ```json
   {
     "port": 3001,
     "autoDetectPort": true
   }
   ```
3. Save and restart tray app

**Method 3: Environment Variable**
```cmd
SET PORT=3001
```

### 3. Toggle Auto-Detection

You can enable/disable auto-detection from the tray menu:

1. Right-click tray icon
2. Click "Auto-detect Port" (shows ✓ when enabled)
3. Setting is saved to config file

**When to disable:**
- You know the exact port and want faster startup
- Running multiple servers and want to target specific one
- Auto-detection is causing issues

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
- `port` (number): The port to check/use for the server
- `autoDetectPort` (boolean): Enable/disable automatic port detection

## Tray Menu

The updated tray menu includes:

```
🟢 Playlist Lab - Running (Port 3001)
├── Open Playlist Lab
├── Server Status
├── ───────────────
├── Start Server
├── Stop Server
├── Restart Server
├── ───────────────
├── Server Port: 3001        ← Click to change
├── ✓ Auto-detect Port       ← Click to toggle
├── ───────────────
├── View Logs
├── Settings
├── ───────────────
└── Exit
```

## Status Indicators

**Tray Icon:**
- 🟢 Green = Server running
- 🔴 Red = Server stopped

**Tooltip:**
- Shows current status
- Shows port number
- Shows uptime (when running)

**Examples:**
```
🟢 Playlist Lab - Running (Port 3001) - 2h 15m
🔴 Playlist Lab - Stopped
```

## Troubleshooting

### Server Not Detected

**Problem:** Tray shows "Stopped" but server is running

**Solutions:**

1. **Check if auto-detect is enabled:**
   - Right-click tray icon
   - Look for ✓ next to "Auto-detect Port"
   - If not checked, click to enable

2. **Manually set the correct port:**
   - Check what port server is using (look at server console)
   - Right-click tray → "Server Port: XXXX"
   - Edit config file with correct port
   - Restart tray app

3. **Check server is actually running:**
   - Open browser to `http://localhost:3001`
   - Check Task Manager for node.exe process
   - Check server logs

### Wrong Port Detected

**Problem:** Tray connects to wrong server instance

**Solutions:**

1. **Disable auto-detect:**
   - Right-click tray → "Auto-detect Port" (remove ✓)
   - Manually set correct port in config

2. **Stop other server instances:**
   - Only run one Playlist Lab Server at a time
   - Check Task Manager for multiple node.exe processes

### Port Change Not Taking Effect

**Problem:** Changed port in config but tray still uses old port

**Solutions:**

1. **Restart tray app:**
   - Right-click tray → Exit
   - Start tray app again from Start Menu

2. **Check config file was saved:**
   - Open `tray-config.json`
   - Verify port value is correct
   - Check file is not read-only

## Server Port Configuration

The server port is configured in the server's `.env` file:

**Location:** `C:\Program Files\Playlist Lab Server\server\.env`

**Setting:**
```
PORT=3001
```

**To change server port:**
1. Edit the `.env` file
2. Change `PORT=3001` to desired port
3. Restart the server
4. Tray app will auto-detect new port (if enabled)

## Common Port Issues

### Port Already in Use

**Error:** Server fails to start, says port is in use

**Solutions:**

1. **Find what's using the port:**
   ```cmd
   netstat -ano | findstr :3001
   ```

2. **Kill the process:**
   ```cmd
   taskkill /PID <process_id> /F
   ```

3. **Use a different port:**
   - Change server `.env` file
   - Restart server
   - Tray will auto-detect

### Firewall Blocking Port

**Problem:** Server runs but can't access from browser

**Solutions:**

1. **Add firewall exception:**
   - Windows Defender Firewall
   - Allow app through firewall
   - Add node.exe

2. **Use different port:**
   - Some ports may be blocked by default
   - Try 3001, 3000, or 8080

## Best Practices

1. **Keep auto-detect enabled** - Most reliable for typical use
2. **Use standard ports** - 3000, 3001, 8080 are commonly allowed
3. **Check tray tooltip** - Shows current port and status
4. **One server instance** - Avoid running multiple servers
5. **Restart after changes** - Always restart tray app after config changes

## Technical Details

### Port Detection Algorithm

1. Load config file (or create with defaults)
2. Build list of ports to check (config port first, then common ports)
3. For each port:
   - Try `/health` endpoint with 1 second timeout
   - If successful, update config and stop checking
   - If failed, try next port
4. If no server found, show "Stopped" status
5. Repeat every 5 seconds

### Health Check Endpoints

The tray app checks these endpoints (in order):

1. `GET http://localhost:{port}/health` - Primary check
2. `GET http://localhost:{port}/` - Fallback check

Both must return HTTP 200 or 304 to be considered "running".

### Configuration Persistence

- Config saved to: `tray-config.json` in install directory
- Automatically created on first run
- Updated when port is detected or manually changed
- Survives tray app restarts

## Examples

### Example 1: Server on Port 3000

```json
{
  "port": 3000,
  "autoDetectPort": true
}
```

Tray will check port 3000 first, then scan other ports if needed.

### Example 2: Fixed Port, No Auto-Detect

```json
{
  "port": 8080,
  "autoDetectPort": false
}
```

Tray will only check port 8080, never scan other ports.

### Example 3: Default Configuration

```json
{
  "port": 3001,
  "autoDetectPort": true
}
```

Tray will check 3001 first, then scan common ports if server not found.
