# FIX IMPORT PAGE - STEP BY STEP

## THE PROBLEM
Your browser is caching old JavaScript. The new code is in the files but not being served.

## THE FIX (Do these steps IN ORDER)

### STEP 1: Stop Everything
Close ALL command prompt windows that are running dev servers.

### STEP 2: Run This Command
```batch
scripts\force-refresh-dev.bat
```

Wait for it to finish and start both servers.

### STEP 3: Clear Browser Cache
**DO THIS OR IT WON'T WORK!**

Open http://localhost:5173 and press:
- **Ctrl + Shift + R** (Chrome/Edge)
- **Ctrl + F5** (Firefox)

OR open in **Incognito/Private window** (easiest way to test)

### STEP 4: Check Console
1. Press **F12** to open DevTools
2. Go to **Console** tab
3. You should see: `[ImportPage] Component mounted - BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH`

**If you DON'T see this message, the old code is still cached!**

### STEP 5: Test Import
1. Go to Import page
2. Select Deezer
3. Paste this URL: `https://www.deezer.com/playlist/1313621735`
4. Click Import

**You should now see:**
- ✅ "Top Global" (not a long ID)
- ✅ Progress bar filling up
- ✅ "X / Y tracks" counter
- ✅ Current track name

### STEP 6: Test Cancel
1. While import is running, click **Cancel**
2. Check console - you should see: `[ImportPage] Cancel button clicked`
3. Modal should close immediately
4. No error message

## STILL NOT WORKING?

### Nuclear Option
```batch
REM Stop all servers
taskkill /F /IM node.exe

REM Delete Vite cache
rmdir /s /q apps\web\node_modules\.vite

REM Delete browser cache
REM Press Ctrl+Shift+Delete in browser and clear everything

REM Restart
scripts\force-refresh-dev.bat
```

### Check File Has Changes
```batch
findstr /C:"BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH" apps\web\src\pages\ImportPage.tsx
```

Should output:
```
    console.log('[ImportPage] Component mounted - BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH');
```

If this doesn't show anything, the file wasn't saved correctly.

## WHAT TO LOOK FOR IN CONSOLE

When you open the Import page, you should see:
```
[ImportPage] Component mounted - BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH
```

When you start an import, you should see:
```
[ImportPage] Progress update: {playlistName: "Top Global", current: 1, total: 50, trackName: "..."}
[ImportPage] Progress update: {playlistName: "Top Global", current: 2, total: 50, trackName: "..."}
...
```

When you click Cancel, you should see:
```
[ImportPage] Cancel button clicked {sessionId: "...", hasEventSource: true}
[ImportPage] Import cancelled, state reset
[ImportPage] Cancel request sent to server
```

## IF CONSOLE SHOWS OLD VERSION

The console log will tell you if the old code is still loaded:
- **OLD**: No console logs at all
- **NEW**: `[ImportPage] Component mounted - BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH`

If you see no logs, your browser is definitely serving cached JavaScript.

**Solutions:**
1. Open in Incognito/Private window
2. Clear ALL browser data (Ctrl+Shift+Delete → Everything → All time)
3. Try a different browser
4. Disable cache in DevTools (F12 → Network tab → check "Disable cache")

## VERIFICATION CHECKLIST

- [ ] Ran `scripts\force-refresh-dev.bat`
- [ ] Both servers started (check for 2 command windows)
- [ ] Cleared browser cache (Ctrl+Shift+R or Incognito)
- [ ] Opened http://localhost:5173
- [ ] Pressed F12 and checked Console tab
- [ ] Saw BUILD_TIMESTAMP log message
- [ ] Tested import - saw playlist name (not ID)
- [ ] Saw progress bar
- [ ] Tested cancel - modal closed immediately

## CONTACT

If ALL of the above doesn't work, provide:
1. Screenshot of browser console (F12 → Console)
2. Screenshot of import modal
3. Output of: `findstr /C:"BUILD_TIMESTAMP" apps\web\src\pages\ImportPage.tsx`
