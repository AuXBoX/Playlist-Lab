# URL Loading Issue - Diagnosis & Solution

## Problem
When you start the server via the tray app and copy the URL (`http://localhost:3001`), nothing loads in the browser.

## Root Cause Analysis

The server is running in **production mode** and trying to serve the web app from static files. The logs show:
- Server is running on port 3001
- Server is in production mode
- Health checks are working

However, when you open the URL in a browser, nothing loads.

## Possible Causes

### 1. Browser Not Connecting
- The server might stop between when you copy the URL and when you paste it
- Check if the server is still running when you try to access it

### 2. Content Security Policy (CSP) Issues
- The helmet middleware might be blocking resources
- Check browser console (F12) for CSP errors

### 3. Static File Path Issues
- The server looks for files at: `C:\Program Files\Playlist Lab Server\web\dist`
- Files exist at that location (verified)
- But something might be preventing them from being served

### 4. Port Mismatch
- Server defaults to port 3000 but tray app uses 3001
- This shouldn't cause issues but worth noting

## Diagnostic Steps

1. **Check if server is actually running**:
   - Look at the tray app - does it say "Running" or "Stopped"?
   - Check the logs - are there recent entries?

2. **Check what the browser shows**:
   - Blank white page? → Static files not loading
   - "Cannot connect"? → Server not running
   - Error message? → Check browser console (F12)

3. **Check browser console**:
   - Press F12 in your browser
   - Go to Console tab
   - Look for errors (red text)
   - Look for Network tab to see what requests are being made

4. **Test the API directly**:
   - Open: `http://localhost:3001/api/health`
   - Should show JSON with server status
   - If this works, server is running but web app isn't loading

## Solutions

### Solution 1: Use Development Mode (Recommended for Development)

1. **Start the web app separately**:
   ```bash
   cd apps/web
   npm run dev
   ```

2. **Open**: `http://localhost:5173`

3. The web app will proxy API requests to the server

### Solution 2: Rebuild and Reinstall (For Production Mode)

1. **Rebuild the server** (already done):
   ```bash
   cd apps/server
   npm run build
   ```

2. **Rebuild the installer**:
   ```bash
   cd scripts/installers/windows
   ./build-windows.bat
   ```

3. **Reinstall** the application

4. **Start the server** via tray app

5. **Open**: `http://localhost:3001`

### Solution 3: Check Browser Console

1. **Open the browser** to `http://localhost:3001`

2. **Press F12** to open developer tools

3. **Check Console tab** for errors

4. **Check Network tab** to see what's being requested

5. **Report back** what you see

## What I Changed

### 1. Added More Logging
**File**: `apps/server/src/index.ts`

Added logging to show:
- Whether the web app path exists
- When index.html is being served
- What path is being requested

This will help diagnose the issue in the server logs.

### 2. Development Mode HTML Page
**File**: `apps/server/src/index.ts`

In development mode, the root `/` endpoint now shows a helpful HTML page with:
- Instructions on how to start the web app
- Link to `http://localhost:5173`
- Server information

## Next Steps

**Please try this**:

1. **Stop the server** in the tray app

2. **Start the server** again

3. **Open your browser** to `http://localhost:3001`

4. **Press F12** to open developer tools

5. **Tell me what you see**:
   - What's in the Console tab?
   - What's in the Network tab?
   - What's on the page itself?

This will help me understand exactly what's happening and provide a targeted fix.

## Quick Test

If you want to test right now without rebuilding:

1. **Open**: `http://localhost:3001/api/health`
   - If this works → Server is running, web app issue
   - If this doesn't work → Server not running

2. **Check the tray app logs**:
   - Look for "Serving static files from:" message
   - Look for any error messages

3. **Try refreshing** the browser (Ctrl+F5 for hard refresh)

## Files Modified

- `apps/server/src/index.ts` - Added logging and diagnostics
- `scripts/test-server-response.js` - New diagnostic script
- `URL_LOADING_ISSUE_SOLUTION.md` - This file
