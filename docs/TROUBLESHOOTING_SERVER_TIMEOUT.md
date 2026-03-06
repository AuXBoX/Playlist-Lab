# Troubleshooting: Server Timeout on Root URL

## Problem

When accessing `http://localhost:3001/` in a browser, the page times out and never loads. However:
- `/health` endpoint works fine
- `/index.html` loads correctly
- Static files (favicon, etc.) load correctly
- Server logs show it's running

## Root Cause

The installed version of the server has OLD compiled code that's missing the `next` parameter in the root route handler. This causes the request to hang instead of falling through to the SPA (Single Page Application) handler.

### Technical Details

**Old Code (installed version):**
```javascript
app.get('/', (_req, res) => {
  if (NODE_ENV === 'development') {
    res.send('...');
  }
  // Missing: else { next(); }
  // Request hangs here in production!
});
```

**Fixed Code (current source):**
```javascript
app.get('/', (_req, res, next) => {
  if (NODE_ENV === 'development') {
    res.send('...');
  } else {
    next(); // Pass to SPA handler
  }
});
```

## Solution

You need to rebuild and reinstall:

### Quick Fix

```bash
cd scripts
build-all-installers.bat
```

Choose option 9 (Windows Server Installer - full pipeline)

This will:
1. Clean previous builds
2. Rebuild shared package
3. Rebuild web app (with verification)
4. Rebuild server (with verification)
5. Build a new installer
6. Generate checksums

3. **Uninstall current version:**
   - Open Settings > Apps > Installed apps
   - Find "Playlist Lab Server"
   - Click Uninstall
   - Wait for completion (the uninstaller will stop all processes)

4. **Install new version:**
   - Run the installer from `scripts\release\`
   - Choose your startup mode
   - Wait for installation

5. **Verify:**
   - Open `http://localhost:3001/`
   - Should load the web interface immediately

## Verification

After reinstalling, verify the fix worked:

```powershell
# Check if root URL loads (should return HTML)
Invoke-WebRequest -Uri "http://localhost:3001/" -UseBasicParsing -TimeoutSec 5

# Should return 200 OK with HTML content
```

## Why This Happened

The issue occurred because:
1. Source code was updated with the fix
2. Server was rebuilt (dist files updated)
3. Installer was built
4. BUT the installed version still had old code

This can happen if:
- The installer build process cached old files
- The installation didn't overwrite existing files
- The server wasn't fully stopped before reinstalling

## Prevention

Always follow this sequence when updating:
1. Stop the server completely (kill all node processes)
2. Rebuild the server (`npm run build`)
3. Build the installer
4. Uninstall old version completely
5. Install new version
6. Verify the fix

## Related Issues

- LOG_DIR permission errors (fixed in same update)
- Server startup failures (fixed in same update)
- Helmet CSP configuration (fixed in same update)
