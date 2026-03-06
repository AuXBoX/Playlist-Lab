# How to Apply the Tray App Fix

The log line error has been fixed in the code. Follow these steps to apply it:

## Step 1: Close the Tray App

Right-click the tray icon and select "Exit" (or just close the window if it's open).

## Step 2: Apply the Fix

Run this command from the project root:

```cmd
scripts\apply-tray-fix.bat
```

This will rebuild the tray app with the fix.

## Step 3: Restart the Tray App

After the build completes, run:

```cmd
scripts\test-tray-app-dev.bat
```

## What Was Fixed

The error `line.toLowerCase is not a function` was caused by sending a `LogEntry` object instead of a string to the renderer. The fix changes this line in `window-manager.ts`:

**Before:**
```typescript
this.window.webContents.send('server:log-line', logEntry);
```

**After:**
```typescript
this.window.webContents.send('server:log-line', logEntry.message);
```

Now the renderer receives a string (the message) instead of an object, so `.toLowerCase()` works correctly.

## Verification

After restarting, the error should be gone and you should see:
- No "toLowerCase is not a function" errors in the console
- Log lines displaying properly (if the server produces any logs)
- All buttons working correctly

The server will still exit with code 1 in dev mode (expected - see TRAY_APP_FIX_COMPLETE.md for details).
