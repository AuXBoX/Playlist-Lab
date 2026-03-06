# Import Progress Field Name Fix

## Problem
The import progress modal was not displaying:
1. **Playlist cover images** - showing gradient + music note instead of actual cover
2. **Current track names during matching** - showing "Fetching playlist..." instead of "Artist - Track"

## Root Cause
**Field name inconsistency** between backend and frontend:
- Backend was emitting `trackName` in progress events
- Frontend was expecting `currentTrackName` in progress events
- This caused the frontend to never receive the track names or properly transition phases

## Changes Made

### 1. Backend Progress Event Field Names (Standardized to `currentTrackName`)

**Files Modified:**
- `apps/server/src/services/matching.ts` - Changed `trackName` to `currentTrackName`
- `apps/server/src/services/import.ts` - Changed `trackName` to `currentTrackName`
- `apps/server/src/services/scrapers.ts` - Changed all `trackName` to `currentTrackName`
- `apps/server/src/services/browser-scrapers.ts` - Changed all `trackName` to `currentTrackName`

### 2. Timing Improvements

**In `apps/server/src/services/import.ts`:**
- Increased delay from 500ms to 1000ms after scraping completes
- This ensures the cover URL and playlist name reach the frontend BEFORE matching starts
- Added more detailed logging to track cover URL emission

### 3. Progress Event Structure

All progress events now use this consistent structure:
```javascript
{
  type: 'progress',
  phase: 'scraping' | 'matching' | 'complete',
  current: number,
  total: number,
  currentTrackName: string,  // ← Standardized field name
  coverUrl?: string,          // Only present after scraping completes
  playlistName?: string       // Only present after scraping completes
}
```

## Expected Behavior After Fix

### During Scraping Phase:
- Modal shows: "Fetching playlist..." or "Loading [Source] page..."
- Cover: Gradient background with music note emoji
- Phase: `scraping`

### After Scraping Completes (1 second pause):
- Modal updates with actual playlist name
- Cover: Actual playlist cover image (if available)
- Track count: Shows total tracks found
- Phase: Still `scraping` but with final count

### During Matching Phase:
- Modal shows: "Artist Name - Track Title" for each track being matched
- Cover: Remains as playlist cover
- Progress bar: Shows X / Y tracks
- Phase: `matching`

### On Completion:
- Modal shows: "Complete: X matched"
- Phase: `complete`
- Brief display before transitioning to review screen

## Testing Instructions

1. **Restart both servers:**
   ```bash
   # Terminal 1 - Server
   cd apps/server
   npm run dev

   # Terminal 2 - Web
   cd apps/web
   npm run dev
   ```

2. **Test with Apple Music playlist:**
   - Go to Import page
   - Select "Apple Music"
   - Paste a playlist URL
   - Click Import
   - **Watch for:**
     - Cover image should appear after scraping completes
     - Track names should display during matching: "Artist - Title"
     - Phase should transition: scraping → matching → complete

3. **Check browser console for logs:**
   - `[ImportPage] SSE message received:` - Should show all progress events
   - Look for `coverUrl` and `currentTrackName` fields in the data

4. **Check server console for logs:**
   - `[Import] Scraping complete. Playlist: ..., Cover: ...`
   - `[Import] Emitting scraping complete event with cover URL: ...`
   - `[Matching] X/Y: Artist - Title`
   - `[Matching] Emitting progress:` - Should show currentTrackName field

## Files Changed

1. `apps/server/src/services/matching.ts` - Field name fix
2. `apps/server/src/services/import.ts` - Field name fix + timing improvement
3. `apps/server/src/services/scrapers.ts` - Field name fix (7 instances)
4. `apps/server/src/services/browser-scrapers.ts` - Field name fix (12 instances)

## No Frontend Changes Needed

The frontend (`apps/web/src/pages/ImportPage.tsx`) was already correctly looking for `currentTrackName` - it was the backend that was using the wrong field name.

## Verification

After restarting servers, the import progress modal should now:
✅ Display actual playlist cover images (when available)
✅ Show current track being matched: "Artist - Track"
✅ Properly transition between phases
✅ Update in real-time as matching progresses
