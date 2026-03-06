# Progress Display Fix - Track Names Not Showing

## Problem

The import progress modal was showing "TrackName: Fetching playlist..." during the scraping phase and not updating with actual track information. The artist and track names were not being displayed properly.

## Root Cause

The issue had two parts:

1. **Frontend Setting Initial State**: The frontend was setting an initial progress state with `currentTrackName: 'Fetching playlist...'` before the backend had a chance to emit any progress events.

2. **Backend Not Emitting Initial Event**: The backend wasn't emitting a progress event at the very start of the scraping phase, so the frontend's initial state persisted.

## Solution

### Backend Changes (`apps/server/src/services/import.ts`)

Added an initial progress event emission at the start of the scraping phase:

```typescript
// Emit initial scraping progress
if (progressEmitter) {
  progressEmitter.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching playlist from ' + source + '...',
  });
}
```

This ensures the backend immediately sends a progress event when scraping starts.

### Frontend Changes (`apps/web/src/pages/ImportPage.tsx`)

Removed the frontend's initial progress state setting:

```typescript
// REMOVED:
// setImportProgress({
//   show: true,
//   playlistName: playlistNameForProgress,
//   source: currentSource?.name || activeSource,
//   currentTrack: 0,
//   totalTracks: 0,
//   currentTrackName: 'Fetching playlist...',
//   phase: 'scraping',
//   coverUrl: undefined,
// });

// REPLACED WITH:
// Don't set initial progress - let backend emit the first event
// This ensures we show the correct message from the start
```

Now the frontend waits for the backend to emit the first progress event instead of setting its own initial state.

## Progress Flow

The complete progress flow is now:

1. **Scraping Start**: Backend emits `"Fetching playlist from {source}..."`
2. **Scraping Complete**: Backend emits `"Found X tracks"` with playlist name and cover URL
3. **Matching Phase**: Backend emits per-track progress with `"{Artist} - {Title}"` for each track
4. **Complete**: Backend emits completion event

## Expected Behavior

Users will now see:
- During scraping: "Fetching playlist from Apple Music..." (or other source)
- After scraping: "Found 101 tracks" (brief pause)
- During matching: "Artist Name - Track Title" for each track being matched
- After matching: Review screen with all matched/unmatched tracks

## Files Modified

1. `apps/server/src/services/import.ts` - Added initial progress emission
2. `apps/web/src/pages/ImportPage.tsx` - Removed frontend initial progress state

## Testing

To verify the fix:
1. Import a playlist from any source
2. Observe the progress modal
3. Verify it shows "Fetching playlist from {source}..." at the start
4. Verify it updates to "Found X tracks" after scraping
5. Verify it shows "{Artist} - {Title}" during matching
6. Verify the debug line shows the correct track names

## Notes

- The backend already had code to emit progress after scraping completes, but it wasn't being seen because the frontend's initial state was overriding it
- The matching phase already correctly emits per-track progress with artist and title
- The 1.5 second delay after scraping completes gives users time to see the "Found X tracks" message before matching starts
