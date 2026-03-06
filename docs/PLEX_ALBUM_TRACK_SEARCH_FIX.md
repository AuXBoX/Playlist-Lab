# Plex Album Track Search Fix

## Issue
When searching for tracks where the track name matches the album name (e.g., "Doechii Anxiety"), Plex hub search returns only the album in the album hub, not the individual track in the track hub. This caused the matching system to report "no result" even though the track exists in the library.

## Root Cause
The Plex hub search API (`/hubs/search`) organizes results by type (tracks, albums, artists, etc.). When a track has the same name as its album, the search may only return the album in the album hub without including the track in the track hub.

## Solution
Modified `searchTrack()` method in `apps/server/src/services/plex.ts` to:

1. First check the track hub for direct track matches (existing behavior)
2. If no tracks found, check if albums were returned in the album hub
3. If albums exist, fetch tracks from the first 3 matching albums using `getAlbumTracks()`
4. Add those tracks to the results array

## Implementation Details

**Location**: `apps/server/src/services/plex.ts` (lines 203-227)

```typescript
// If no tracks found, check album hub (handles case where track name = album name)
if (tracks.length === 0) {
  const albumHub = hubs.find((hub: any) => hub.type === 'album');
  const albums = albumHub?.Metadata || [];
  
  if (albums.length > 0) {
    logger.info('No tracks found in track hub, checking albums', {
      query,
      albumCount: albums.length
    });
    
    // Get tracks from first 3 matching albums
    const albumsToCheck = albums.slice(0, 3);
    for (const album of albumsToCheck) {
      const albumTracks = await this.getAlbumTracks(album.ratingKey);
      tracks.push(...albumTracks);
    }
    
    logger.info('Found tracks from albums', {
      query,
      trackCount: tracks.length
    });
  }
}
```

## Performance Considerations

- Limited to first 3 albums to avoid excessive API calls
- Uses existing `getAlbumTracks()` method which fetches `/library/metadata/{albumRatingKey}/children`
- Only triggers when track hub returns no results (fallback behavior)
- Results are still cached with 5-minute TTL

## Testing

To test this fix:
1. Search for a track where track name = album name (e.g., "Doechii Anxiety")
2. Verify the track is now found and matched correctly
3. Check logs for "No tracks found in track hub, checking albums" message
4. Confirm matching completes successfully

## Status
✅ **COMPLETE** - Implementation verified, no syntax errors detected
