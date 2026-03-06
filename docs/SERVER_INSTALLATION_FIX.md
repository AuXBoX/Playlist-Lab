# Server Installation Issues Fix

## Issue

When trying to start the Playlist Lab Server, you get an error:
```
Error: Cannot find module 'express'
Server exited unexpectedly with code 1 (general error - check logs for details)
```

And when accessing `http://localhost:3000/`, the browser shows "Cannot GET /" error.

## Root Causes

There are **two** issues with the current installation:

### 1. Missing Dependencies
The installed server at `C:\Program Files\Playlist Lab Server\server\` is missing its `node_modules` folder. The server needs Express and other dependencies to run.

### 2. Wrong Environment Mode
The `.env` file has `NODE_ENV=development` instead of `NODE_ENV=production`, causing the server to run in development mode (which returns JSON instead of serving the web app).

## Solution

### Quick Fix (Recommended)

Run the complete fix script **as Administrator**:

1. Navigate to your project folder: `K:\Projects\Playlist Lab`
2. Right-click on `scripts\fix-installed-server-complete.bat`
3. Select **"Run as administrator"**
4. Wait for dependencies to install (may take 2-3 minutes)
5. The script will also fix the NODE_ENV setting
6. Start the server from the tray app
7. Open `http://localhost:3000/` - you should now see the web app!

### Manual Fix

If you prefer to fix it manually:

**Step 1: Install Dependencies**

1. Open Command Prompt **as Administrator**
2. Run these commands:
   ```cmd
   cd "C:\Program Files\Playlist Lab Server\server"
   "C:\Program Files\Playlist Lab Server\nodejs\npm.cmd" install --production --no-optional
   ```
3. Wait for installation to complete

**Step 2: Fix NODE_ENV**

1. Open Notepad **as Administrator**
2. File → Open: `C:\Program Files\Playlist Lab Server\server\.env`
3. Change line 2 from `NODE_ENV=development` to `NODE_ENV=production`
4. Save and close

**Step 3: Start Server**

1. Open the Playlist Lab Server Manager from the tray
2. Click "Start Server"
3. Open `http://localhost:3000/` in your browser

## What Was Fixed

### In Your Installation
- ✅ Created `scripts/fix-installed-server-complete.bat` - Complete fix script
- ✅ Created `scripts/fix-installed-server-dependencies.bat` - Dependencies only
- ✅ Created `scripts/fix-installed-server-env.bat` - NODE_ENV only

### In Source Code
1. ✅ Updated `apps/server/.env.example` - Changed default from `development` to `production`
2. ✅ Updated `scripts/installers/windows/setup.iss` - Added automatic `npm install` during installation

### Future Builds
Future installations will:
- Automatically install dependencies during setup
- Use production mode by default
- Not require manual fixes

## Verification

After applying the fix:

1. Server logs should show: `Server running on port 3000 in production mode`
2. Opening `http://localhost:3000/` should show the Playlist Lab web application
3. No "Cannot find module" errors

## Technical Details

### Why Dependencies Were Missing

The Inno Setup installer was copying the root `node_modules` to `{app}\node_modules`, but the server needs its own dependencies in `{app}\server\node_modules`. 

The server's `package.json` has dependencies like:
- express
- better-sqlite3
- winston
- helmet
- cors
- etc.

These need to be installed in the server directory.

### Why NODE_ENV Matters

- **Development mode**: 
  - Returns JSON API info at `/`
  - Disables background jobs
  - Uses less secure settings
  - Verbose logging

- **Production mode**: 
  - Serves the web app at `/`
  - Enables background jobs
  - Uses secure settings
  - Optimized performance

### Files Modified

- `apps/server/.env.example` - Default environment now production
- `scripts/installers/windows/setup.iss` - Added npm install step
- `scripts/fix-installed-server-complete.bat` - Complete fix script
- `scripts/fix-installed-server-dependencies.bat` - Dependencies fix
- `scripts/fix-installed-server-env.bat` - Environment fix
