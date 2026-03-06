# Quick Start Guide

## Starting the Development Server

Simply run:
```batch
scripts\start-dev.bat
```

This will automatically:
1. ✓ Kill old Node processes
2. ✓ Clear Vite cache
3. ✓ Clean ports 3000 and 5173
4. ✓ Start API server (http://localhost:3000)
5. ✓ Start web app (http://localhost:5173)

## After Starting

**IMPORTANT:** Clear your browser cache to see the latest changes!

- **Chrome/Edge**: Press `Ctrl + Shift + R`
- **Firefox**: Press `Ctrl + F5`
- **Best for testing**: Open in Incognito/Private window

## Verify It's Working

1. Open http://localhost:5173
2. Press `F12` to open DevTools
3. Go to Console tab
4. You should see: `[ImportPage] Component mounted - BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH`

**If you see this message, you're running the latest code!**

## Test the Import Page

1. Go to Import page
2. Select Deezer
3. Paste: `https://www.deezer.com/playlist/1313621735`
4. Click Import

**You should see:**
- ✅ "Top Global" (not a long ID string)
- ✅ Progress bar filling up
- ✅ "X / Y tracks" counter
- ✅ Current track name during matching

**Test Cancel:**
- Click Cancel button while importing
- Modal should close immediately
- No error message should appear
- Console should show: `[ImportPage] Cancel button clicked`

## Troubleshooting

### Changes not visible?
1. Make sure you cleared browser cache (Ctrl+Shift+R)
2. Try opening in Incognito/Private window
3. Check console for BUILD_TIMESTAMP message

### Port already in use?
The start script automatically cleans ports, but if it fails:
```batch
scripts\cleanup-dev.bat
```

### Still having issues?
1. Close ALL command prompt windows
2. Run: `taskkill /F /IM node.exe`
3. Run: `scripts\start-dev.bat`
4. Clear browser cache again

## Console Debug Messages

When everything is working, you'll see these console messages:

**On page load:**
```
[ImportPage] Component mounted - BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH
```

**During import:**
```
[ImportPage] Progress update: {playlistName: "Top Global", current: 1, total: 50, ...}
[ImportPage] Progress update: {playlistName: "Top Global", current: 2, total: 50, ...}
```

**When cancelling:**
```
[ImportPage] Cancel button clicked {sessionId: "...", hasEventSource: true}
[ImportPage] Import cancelled, state reset
[ImportPage] Cancel request sent to server
```

## What Changed

### Import Progress Modal
- Shows actual playlist name instead of session ID
- Visual progress bar that fills as tracks are matched
- Shows current track count (e.g., "25 / 50 tracks")
- Shows current track name during matching
- Better status messages

### Cancel Button
- Immediately closes modal
- Stops import process
- No error message on cancel
- Proper cleanup of SSE connection

## Files Modified

- `scripts/start-dev.bat` - Now includes automatic cleanup
- `apps/web/src/pages/ImportPage.tsx` - Updated UI and cancel logic
- `apps/server/src/services/matching.ts` - Progress event emission
- `apps/server/src/routes/import.ts` - SSE progress endpoint

## Need Help?

Check these files for detailed instructions:
- `FIX_IMPORT_PAGE_NOW.md` - Step-by-step troubleshooting
- `FORCE_REFRESH_INSTRUCTIONS.md` - Detailed cache clearing guide
