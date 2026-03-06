# Import Progress Display Fix

## Problem
When importing playlists from YouTube Music (and other services), the progress modal was showing only "🎵 Fetching tracks..." without displaying:
- Track count (e.g., "25 / 100 tracks")
- Current track name being processed
- Detailed progress information

## Root Cause
The browser scrapers (YouTube Music, Apple Music, Tidal, Amazon Music, Qobuz) were emitting progress events with `total: 0` during the scraping phase. They only knew the total track count AFTER completing the scraping operation.

Additionally, the YouTube Music scraper was emitting individual progress events for each track AFTER scraping was complete, which happened too quickly for the UI to display.

## Solution

### 1. Updated Browser Scrapers
Modified all browser scrapers to emit a final progress event with the total track count immediately after scraping completes:

**Files Modified:**
- `apps/server/src/services/browser-scrapers.ts`

**Changes:**
- YouTube Music scraper: Removed the loop that emitted progress for each track after scraping
- All scrapers now emit a single progress event after scraping with the actual track count:
  ```typescript
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: result.tracks.length,
    total: result.tracks.length,
    trackName: `Found ${result.tracks.length} tracks`
  });
  ```

### 2. Improved Progress Modal Display
Updated the progress modal to show the `currentTrackName` even when `totalTracks` is 0:

**File Modified:**
- `apps/web/src/pages/ImportPage.tsx`

**Changes:**
- Progress modal now displays `importProgress.currentTrackName` during scraping phase
- Shows detailed status messages like:
  - "Loading YouTube Music page..."
  - "Navigating to playlist..."
  - "Waiting for content to load..."
  - "Extracting track data..."
  - "Found X tracks"

## Result
The progress modal now shows:
1. **During scraping**: Detailed status messages about what's happening
2. **After scraping**: Track count and "Found X tracks" message
3. **During matching**: Track-by-track progress with current track name
4. **On completion**: Final matched count

## Testing
To test the fix:
1. Go to Import page
2. Select YouTube Music (or any other service)
3. Paste a playlist URL
4. Click Import
5. Observe the progress modal showing detailed status messages during scraping
6. After scraping completes, see the track count displayed
7. During matching, see individual track progress

## Technical Details

### Progress Event Flow
1. **Scraping Phase** (`phase: 'scraping'`):
   - Initial events: `total: 0`, descriptive `trackName`
   - Final event: `total: X`, `current: X`, `trackName: "Found X tracks"`

2. **Matching Phase** (`phase: 'matching'`):
   - Events for each track: `total: X`, `current: N`, `trackName: "Artist - Title"`

3. **Complete Phase** (`phase: 'complete'`):
   - Final event with completion message

### SSE Connection
- Frontend establishes EventSource connection to `/api/import/progress/:sessionId`
- Backend emits progress events through EventEmitter
- Frontend updates `importProgress` state on each event
- Progress modal reactively displays current state

## Files Changed
1. `apps/server/src/services/browser-scrapers.ts` - Added final progress emission for all scrapers
2. `apps/web/src/pages/ImportPage.tsx` - Improved progress modal to show trackName when total is 0
