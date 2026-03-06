# Tray App Status Detection Fix

## Problem
The tray app shows "Stopped" even when the server is running at http://localhost:3001.

## Root Causes

1. **Health check endpoint mismatch** - Tray app checks `/health` but might timeout
2. **Process detection issue** - Server might be running but not detected
3. **Icon doesn't show status** - No visual indicator of connection state

## Solutions

### 1. Fix Health Check (Immediate)

The tray app checks `http://localhost:3001/health` but might be timing out. Try these fixes:

**Option A: Restart the tray app**
1. Right-click the tray icon
2. Click "Exit"
3. Open Start Menu
4. Search for "Playlist Lab Server"
5. Click to restart the tray app

**Option B: Check if server is actually running**
1. Open http://localhost:3001 in your browser
2. If it loads, the server IS running (tray app is wrong)
3. If it doesn't load, start the server from the tray app

### 2. Improved Status Detection

The tray app needs better status detection logic:

```javascript
// Check multiple endpoints
async function checkServerStatus() {
  // Try health endpoint first
  try {
    const response = await fetch('http://localhost:3001/health', { 
      timeout: 2000 
    });
    if (response.ok) return true;
  } catch (e) {}
  
  // Try root endpoint as fallback
  try {
    const response = await fetch('http://localhost:3001/', { 
      timeout: 2000 
    });
    if (response.ok) return true;
  } catch (e) {}
  
  return false;
}
```

### 3. Create Status Indicator Icons

The tray app needs proper icons with color indicators:

**Icon Requirements:**
- Base icon: Playlist Lab logo (music note or playlist symbol)
- Green overlay/dot: Server running and connected
- Red overlay/dot: Server stopped or not responding
- Yellow overlay/dot: Server starting or unknown state

**Icon Specifications:**
- Format: `.ico` (Windows icon format)
- Sizes: 16x16, 32x32, 48x48, 256x256 (multi-resolution)
- Location: `C:\Program Files\Playlist Lab Server\icons\`

**Creating Icons:**

1. **Using GIMP (Free)**:
   - Create 256x256 image with transparent background
   - Draw playlist icon (music notes, list, etc.)
   - Add colored circle in bottom-right corner (green/red/yellow)
   - Export as PNG
   - Use online converter to create .ico file

2. **Using Icon Generator**:
   - Go to https://www.favicon-generator.org/
   - Upload your PNG
   - Download as .ico
   - Rename to `server-running.ico` and `server-stopped.ico`

3. **Quick Fix - Use Emoji Icons**:
   ```javascript
   // In tray-app.js, use Unicode symbols
   const ICON_RUNNING = '🟢'; // Green circle
   const ICON_STOPPED = '🔴'; // Red circle
   const ICON_STARTING = '🟡'; // Yellow circle
   ```

### 4. Manual Status Check

If the tray app is unreliable, check status manually:

**Method 1: Browser**
- Open http://localhost:3001
- If it loads → Server is running
- If it fails → Server is stopped

**Method 2: Task Manager**
1. Press Ctrl+Shift+Esc
2. Go to "Details" tab
3. Look for `node.exe` processes
4. If you see multiple node.exe → Server is likely running

**Method 3: Command Line**
```cmd
netstat -ano | findstr :3001
```
- If you see output → Server is running on port 3001
- If no output → Server is not running

### 5. Rebuild Tray App with Fixes

To apply the fixes, rebuild the installer with the updated tray app code.

## Temporary Workaround

Until the tray app is fixed, ignore its status and:

1. **Check if server is running**: Open http://localhost:3001 in browser
2. **Start server manually**: Run `C:\Program Files\Playlist Lab Server\server-launcher.js`
3. **Stop server manually**: Close the Node.js console window or use Task Manager

## Long-term Solution

The tray app needs these improvements:

1. **Better health checks** - Multiple endpoints, longer timeout
2. **Process monitoring** - Track the actual Node.js process PID
3. **Visual indicators** - Proper icons with color overlays
4. **Status polling** - Check every 3-5 seconds instead of 5 seconds
5. **Error handling** - Show why connection failed (timeout, refused, etc.)
6. **Notification** - Toast notification when status changes

## Testing the Fix

After rebuilding:

1. Start the server
2. Wait 5 seconds
3. Check tray icon - should show green/running
4. Stop the server
5. Wait 5 seconds
6. Check tray icon - should show red/stopped
7. Double-click icon - should open http://localhost:3001

## Icon Design Mockup

```
┌─────────────┐
│  ♪ ♫ ♪      │  ← Playlist/music symbol
│   ═══       │  ← List lines
│   ═══       │
│   ═══    ●  │  ← Status dot (green/red)
└─────────────┘
```

The status dot in the corner clearly shows:
- 🟢 Green = Running
- 🔴 Red = Stopped
- 🟡 Yellow = Starting/Unknown
