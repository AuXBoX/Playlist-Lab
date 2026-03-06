# Save Missing Tracks Feature

## Summary
Added ability to save unmatched tracks to the Missing Tracks section when creating a playlist from an import.

## Changes Made

### 1. Frontend - Import Review Screen (ImportPage.tsx)

**Added Handler Function**: `handleSaveMissingTracks()`
- Creates playlist with matched tracks
- Saves unmatched tracks to Missing Tracks database
- Calls `confirmImport` with `saveMissingTracks: true` flag
- Passes unmatched tracks as `missingTracks` array

**Added UI Button**:
- New button: "Save with Missing (X)" where X is the count of unmatched tracks
- Only shows when there are unmatched tracks (`unmatchedCount > 0`)
- Positioned between "Create Playlist" and "Cancel" buttons
- Tooltip explains functionality
- Shows "Saving..." state during operation

### 2. Backend - Import Confirm Endpoint (import.ts)

**New Endpoint**: `POST /api/import/confirm`
- Creates Plex playlist with matched tracks
- Saves playlist to database
- Optionally saves missing tracks if `saveMissingTracks` flag is true
- Uses existing `db.addMissingTracks()` method

**Parameters**:
```typescript
{
  playlistName: string;
  source: string;
  sourceUrl?: string;
  tracks: MatchedTrack[];
  saveMissingTracks?: boolean;  // NEW
  missingTracks?: Array<{       // NEW
    title: string;
    artist: string;
    album?: string;
  }>;
}
```

**Process**:
1. Validates input parameters
2. Gets user's Plex credentials
3. Creates playlist in Plex with matched tracks
4. Saves playlist to database
5. If `saveMissingTracks` is true, saves unmatched tracks to `missing_tracks` table
6. Returns created playlist info

### 3. API Client Update (packages/shared/src/api/index.ts)

**Updated Type Definition**:
- Added optional `saveMissingTracks?: boolean` parameter
- Added optional `missingTracks?: Array<...>` parameter
- Maintains backward compatibility (both parameters are optional)

## User Flow

### Before:
1. Import playlist
2. Review matched/unmatched tracks
3. Click "Create Playlist" → Only matched tracks saved
4. Unmatched tracks lost

### After:
1. Import playlist
2. Review matched/unmatched tracks
3. Two options:
   - **"Create Playlist (X)"** → Only matched tracks (existing behavior)
   - **"Save with Missing (Y)"** → Matched tracks + save unmatched to Missing Tracks

## Benefits

1. **No Data Loss**: Unmatched tracks are preserved for later matching
2. **Easy Retry**: Users can retry matching from Missing Tracks page
3. **Track Progress**: See which tracks couldn't be matched
4. **Flexible Workflow**: Choose whether to save missing tracks or not

## Database Schema

Uses existing `missing_tracks` table:
```sql
CREATE TABLE missing_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  playlist_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  position INTEGER,
  after_track_key TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);
```

## Example Usage

### Scenario: Import YouTube Music playlist with 100 tracks
- 85 tracks matched
- 15 tracks unmatched

**Option 1**: Click "Create Playlist (85)"
- Creates playlist with 85 matched tracks
- 15 unmatched tracks discarded

**Option 2**: Click "Save with Missing (15)"
- Creates playlist with 85 matched tracks
- Saves 15 unmatched tracks to Missing Tracks
- Can retry matching later from Missing Tracks page
- Can manually search and match from Missing Tracks page

## Integration with Existing Features

### Missing Tracks Page
- Saved tracks appear in Missing Tracks page
- Grouped by playlist
- Can retry matching all or individual tracks
- Can manually search and match
- Can delete if no longer needed

### Retry Matching
- Existing retry functionality works with saved tracks
- Automatically adds matched tracks to original playlist
- Removes from missing tracks when matched

## Testing

To test the feature:

1. **Import a playlist with some unmatched tracks**:
   - Go to Import page
   - Import any playlist
   - Wait for matching to complete

2. **Review screen should show**:
   - Matched count
   - Unmatched count
   - Two buttons if there are unmatched tracks

3. **Click "Save with Missing (X)"**:
   - Should create playlist
   - Should save unmatched tracks
   - Should redirect to playlists page

4. **Check Missing Tracks page**:
   - Should see saved unmatched tracks
   - Should be grouped under the playlist name
   - Can retry matching or delete

## Future Enhancements

1. **Auto-retry**: Automatically retry matching missing tracks periodically
2. **Bulk operations**: Select multiple missing tracks for batch operations
3. **Smart suggestions**: Suggest similar tracks from library
4. **External search**: Search external services for missing tracks
5. **Import history**: Track which imports had missing tracks
