# Track Name Display Fix - Instructions

## Problem
The import progress modal is not showing current track names during matching.

## Root Cause
Your browser is showing OLD CACHED CODE. The screenshot shows "setting playlist, fetching tracks..." which is NOT in the current codebase.

## Solution

### CRITICAL: Clear Browser Cache

You MUST clear your browser cache to see the new code:

**Option 1: Hard Refresh (Recommended)**
- Chrome/Edge: Press `Ctrl + Shift + R`
- Firefox: Press `Ctrl + F5`
- Do this 2-3 times to ensure cache is cleared

**Option 2: Use Incognito/Private Window**
- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`
- Edge: `Ctrl + Shift + N`

**Option 3: Clear All Cache**
1. Chrome: Settings → Privacy → Clear browsing data
2. Select "Cached images and files"
3. Click "Clear data"

### Verify New Code is Loading

After clearing cache, open the browser console (F12) and check for:
```
[ImportPage] Component mounted - BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH
```

### What Should Happen (New Code)

1. **During Scraping Phase:**
   - Shows: "Fetching playlist..."
   - Progress bar is indeterminate (animated)

2. **During Matching Phase:**
   - Shows: "Artist Name - Track Title" (actual track being matched)
   - Progress bar fills based on current/total tracks
   - Example: "The Beatles - Hey Jude"

3. **Completion:**
   - Shows: "Complete!"
   - Brief pause before showing review screen

### Debug Logging

The new code includes extensive logging. Check browser console for:
```
[ImportPage] Progress update: { playlistName: "...", current: 1, total: 50, trackName: "Artist - Title" }
```

Check server console for:
```
[Matching] 1/50: Artist Name - Track Title
[Matching] Emitting progress: { type: 'progress', current: 1, total: 50, trackName: '...', phase: 'matching' }
[SSE] Progress event received: { ... }
[SSE] Sending event: { ... }
```

### If Still Not Working

1. Stop both servers (close the terminal windows)
2. Run: `scripts\start-dev.bat` (answer Yes to kill processes)
3. Wait 15 seconds for servers to start
4. Open browser in Incognito mode
5. Navigate to http://localhost:5173
6. Check console for BUILD_TIMESTAMP

## Changes Made

### Backend (`apps/server/src/services/matching.ts`)
- Added detailed logging for each progress emission
- Emits: `{ type: 'progress', current, total, trackName, phase: 'matching' }`

### Backend (`apps/server/src/routes/import.ts`)
- Added SSE event logging
- Properly forwards progress events to frontend

### Frontend (`apps/web/src/pages/ImportPage.tsx`)
- Updated progress modal to show track names
- Conditional display based on phase:
  - `scraping`: "Fetching playlist..."
  - `matching`: Shows actual track name
  - `complete`: "Complete!"

## Expected Behavior

When importing a playlist:
1. Modal appears with playlist cover (if available) or gradient
2. Shows "Fetching playlist..." while scraping
3. Once matching starts, shows each track name as it's being matched
4. Progress bar fills from 0% to 100%
5. Shows "Complete!" briefly
6. Opens review screen

The track names should update in real-time as each track is matched!
