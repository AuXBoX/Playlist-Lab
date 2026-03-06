# Quick Fix Guide - Server Not Loading

## The Problem

When you open `http://localhost:3001/` in your browser, the page times out and never loads.

## The Solution

The installed version has old compiled code. You need to rebuild and reinstall.

## Steps

### 1. Rebuild Everything

```bash
cd scripts
build-all-installers.bat
```

Choose option **9** (Windows Server Installer - full pipeline)

This will:
- Clean all previous builds
- Rebuild shared package
- Rebuild web app with verification
- Rebuild server with verification  
- Create a new installer
- Generate checksums

Wait for it to complete (may take a few minutes).

### 2. Uninstall Current Version

1. Open **Settings** > **Apps** > **Installed apps**
2. Find **"Playlist Lab Server"**
3. Click **Uninstall**
4. Wait for uninstall to complete (it will stop all processes automatically)

### 3. Install New Version

1. Open `scripts\release\` folder (should open automatically)
2. Run the new installer (e.g., `PlaylistLabServer-Setup-2.0.0.exe`)
3. Choose your startup mode:
   - **Manual Start** - You start it when needed
   - **Start on Login** - Starts automatically when you log in
   - **Windows Service** - Runs in background always
4. Wait for installation to complete

### 4. Verify It Works

1. The tray app should start automatically (green icon = running)
2. Open `http://localhost:3001/` in your browser
3. The web interface should load immediately!

## What Was Fixed

The build script now:
- **Cleans** the `dist` folder before rebuilding (prevents old code)
- **Verifies** compiled files exist after build
- **Ensures** fresh compilation every time

This guarantees the installer always contains the latest code.

## If It Still Doesn't Work

Check the troubleshooting guide:
```
docs/TROUBLESHOOTING_SERVER_TIMEOUT.md
```

Or check the logs:
```
C:\Users\YourUsername\AppData\Roaming\PlaylistLabServer\logs\
```
