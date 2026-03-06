# Import Progress UI - Restart Instructions

## Problem
The import progress modal has been updated to show:
- Playlist name instead of long ID string
- Visual progress bar
- Current track being matched
- Better status messages

However, these changes are not visible because the dev server needs to be restarted.

## Solution

### Option 1: Use the Restart Script (Recommended)
1. Close all existing dev server windows
2. Run: `scripts\restart-dev.bat`
3. Wait for both servers to start
4. Open http://localhost:5173
5. **IMPORTANT**: Clear browser cache (Ctrl+Shift+Delete) or hard refresh (Ctrl+F5)

### Option 2: Manual Restart
1. Close all existing dev server windows
2. Run the port cleanup script: `scripts\cleanup-dev.bat`
3. Start the dev servers: `scripts\start-dev.bat`
4. **IMPORTANT**: Clear browser cache (Ctrl+Shift+Delete) or hard refresh (Ctrl+F5)

### Option 3: Kill Processes Manually
1. Open Task Manager (Ctrl+Shift+Esc)
2. Find and end all `node.exe` processes
3. Run: `scripts\start-dev.bat`
4. **IMPORTANT**: Clear browser cache (Ctrl+Shift+Delete) or hard refresh (Ctrl+F5)

## What Changed

### Import Progress Modal (`apps/web/src/pages/ImportPage.tsx` lines 1872-1970)

**Before:**
- Showed "Importing {long-session-id}"
- No progress bar
- Minimal status information

**After:**
- Shows actual playlist name (e.g., "Top 50 Global")
- Visual progress bar that fills as tracks are matched
- Shows current track count (e.g., "25 / 50 tracks")
- Shows current track name during matching
- Better phase indicators:
  - "Fetching playlist..." during scraping
  - "Matching tracks..." during matching
  - "Complete!" when done

### How Playlist Name is Determined

1. **AI Generated**: "AI Generated Playlist"
2. **ListenBrainz**: Uses username
3. **URL-based imports**: Extracts name from URL
4. **After completion**: Uses actual playlist name from result

### Progress Updates

The progress is updated via Server-Sent Events (SSE):
- Backend sends progress events with track count and current track name
- Frontend updates the modal in real-time
- Progress bar animates smoothly

## Verification

After restarting and clearing cache:

1. Go to Import page
2. Select any source (e.g., Spotify, Deezer)
3. Paste a playlist URL
4. Click Import
5. You should see:
   - Playlist name (not session ID)
   - Progress bar filling up
   - Current track count
   - Current track name during matching

## Troubleshooting

### Changes still not visible
- Make sure you cleared browser cache (Ctrl+Shift+Delete)
- Try hard refresh (Ctrl+F5)
- Try opening in incognito/private window
- Check browser console for errors

### Import not working
- Check that backend server is running on port 3000
- Check that frontend server is running on port 5173
- Check browser console for errors
- Check backend logs in the server window

### Progress not updating
- Check that SSE connection is established (Network tab in DevTools)
- Look for `/api/import/progress/{sessionId}` connection
- Should show "EventStream" type
- Should remain open during import

## Files Modified

1. `apps/web/src/pages/ImportPage.tsx` - Progress modal UI
2. `apps/server/src/services/matching.ts` - Progress event emission
3. `apps/server/src/services/import.ts` - Progress emitter parameter
4. `scripts/restart-dev.bat` - New restart script (created)

## Next Steps

After verifying the progress modal works:
1. Test with different playlist sources
2. Test cancel functionality
3. Test with large playlists (100+ tracks)
4. Verify progress bar animation is smooth
