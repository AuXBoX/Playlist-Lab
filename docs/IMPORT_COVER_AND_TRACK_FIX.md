# Import Progress Cover Image and Track Name Fix

## Issues Fixed

### 1. Cover Image Not Displaying
**Problem**: The playlist cover image was not showing in the import progress modal - it showed a gradient background instead.

**Root Cause**: The cover URL was being extracted during scraping but was lost when the matching phase started, because matching progress events didn't include the coverUrl field.

**Solution**:
- Updated `matchPlaylist()` function signature to accept `coverUrl` and `playlistName` parameters
- Modified matching service to include these fields in all progress events
- Updated import service to pass coverUrl and playlistName to the matching function
- Improved Apple Music scraper to wait for images to load before extracting

### 2. Track Names Not Displaying During Matching
**Problem**: During the matching phase, track names (Artist - Title) were not showing in the modal.

**Root Cause**: 
1. Frontend was looking for `data.trackName` but backend was emitting `data.currentTrackName`
2. Browser scrapers were inconsistent - some used `trackName`, others used `currentTrackName`

**Solution**:
- Standardized all scrapers and services to use `currentTrackName` field
- Updated frontend SSE handler to read `data.currentTrackName`
- Updated modal to display `currentTrackName` during all phases (scraping, matching, complete)

## Files Modified

### Backend Changes

1. **apps/server/src/services/matching.ts**
   - Added `coverUrl?: string` and `playlistName?: string` parameters to `matchPlaylist()`
   - Updated progress emission to include coverUrl and playlistName

2. **apps/server/src/services/import.ts**
   - Pass coverUrl and playlistName to matchPlaylist()
   - Added detailed logging of scraping complete event with JSON.stringify()

3. **apps/server/src/services/browser-scrapers.ts**
   - Fixed Apple Music scraper to wait for images with `page.waitForSelector('img')`
   - Increased wait time from 8s to 10s + 5s for images to load
   - Added `imageCount` to return value for better debugging
   - Removed browser console.log statements, added server-side logging
   - Standardized all scrapers to use `currentTrackName` field

### Frontend Changes

4. **apps/web/src/pages/ImportPage.tsx**
   - Updated SSE event handler to use `data.currentTrackName` instead of `data.trackName`
   - Updated modal to show `currentTrackName` during scraping phase as well
   - All console.log statements now reference `currentTrackName`

## Testing Instructions

1. **Stop both servers** (if running)
2. **Restart servers**: Run `scripts/start-dev.bat`
3. **Test Apple Music import**:
   - Go to Import page
   - Select Apple Music
   - Paste an Apple Music playlist URL
   - Click Import
4. **Verify**:
   - Modal should show the actual playlist cover image (not gradient)
   - During scraping: Should show "Found X tracks"
   - During matching: Should show "Artist - Track Title" for each track
   - Debug line should show "CoverURL: yes" if cover was extracted

## Expected Behavior

### Scraping Phase
- Modal shows playlist cover image (if available)
- Shows "Found X tracks" message
- Progress bar is indeterminate or shows scraping progress

### Matching Phase
- Modal KEEPS showing the playlist cover image
- Shows current track being matched: "Artist - Track Title"
- Progress bar shows X / Y tracks
- Each track name updates as matching progresses

### Complete Phase
- Modal shows "Complete: X matched" message
- Cover image still visible
- Brief pause before showing review screen

## Debug Information

The modal includes a debug line (to be removed later):
```
Phase: matching | TrackName: Artist - Title | CoverURL: yes
```

This helps verify:
- `Phase` is correct (scraping/matching/complete)
- `TrackName` is populated with actual track info
- `CoverURL` is "yes" when cover image was extracted

## Notes

- Apple Music cover extraction depends on images being loaded in the headless browser
- Some playlists may not have cover images available
- The 1500ms delay after scraping ensures frontend receives the cover URL before matching starts
- All progress events now consistently use `currentTrackName` field
