# Import Review/Edit Feature - Implementation Complete

## Overview
Successfully implemented the full import review/edit screen with all features matching the desktop app, allowing users to review matches, manually rematch tracks, reorder tracks, and filter results before creating playlists.

## Implemented Features

### 1. ✅ Enhanced Review Screen Layout
- **Match score display**: Shows percentage scores (100%, 95%, etc.) with color coding
  - Green for 100% matches
  - Yellow/orange for 90-99% matches  
  - Red for unmatched tracks
- **Source → Matched mapping**: Displays original track name with arrow (→) pointing to matched Plex track
- **Complete track details**: Title, Artist, Album, Format (codec + bitrate), Score
- **Drag handle column**: ⋮⋮ icon for visual indication of draggable rows
- **Track numbering**: Sequential numbering for all tracks
- **Editable playlist name**: Input field at top of review screen
- **Match statistics**: Shows "X matched, Y unmatched" count

### 2. ✅ Manual Rematch Modal
- **Click to open**: Click any track row to open rematch modal
- **Search functionality**: 
  - Search input with Enter key support
  - Backend endpoint `/api/import/search` for Plex library search
  - Real-time search results display
- **Results table**: Shows all matching tracks with full details
- **Select button**: Click to select new match from results
- **Auto-update**: Updates track in review list with new match
- **100% score**: Manual matches automatically get 100% score
- **Modal UI**: Clean modal with close button and cancel option

### 3. ✅ Drag and Drop Reordering
- **HTML5 Drag API**: Native drag and drop implementation
- **Visual feedback**: 
  - Drag handle (⋮⋮) shows draggable state
  - Row opacity changes during drag (50%)
  - Cursor changes to grab/grabbing
- **Live reordering**: Tracks reorder in real-time as you drag
- **State management**: Updates editableTracks array with new order

### 4. ✅ Filter Controls
- **"Show unmatched only" checkbox**: Filters table to show only unmatched tracks
- **Dynamic statistics**: Match counts update based on filter state
- **Persistent state**: Filter state maintained during session

### 5. ✅ Export Missing Tracks
- **CSV export**: Downloads unmatched tracks as CSV file
- **Included fields**: Title, Artist, Album
- **Proper formatting**: Handles quotes and special characters
- **Auto-naming**: File named as `{playlistName}_missing_tracks.csv`
- **Button visibility**: Only shown when there are unmatched tracks
- **Count display**: Shows number of missing tracks in button text

### 6. ✅ Backend Support
- **Search endpoint**: `POST /api/import/search`
  - Accepts `query` parameter
  - Returns array of matching tracks with all fields
  - Includes: ratingKey, title, artist, album, codec, bitrate, duration
- **Authentication**: Requires user session
- **Server configuration**: Automatically gets Plex server URL and token from database
- **Error handling**: Proper error messages for missing configuration

## Technical Implementation

### Frontend Changes (`apps/web/src/pages/ImportPage.tsx`)

#### New State Variables
```typescript
const [editableTracks, setEditableTracks] = useState<MatchedTrack[]>([]);
const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
const [rematchTrack, setRematchTrack] = useState<{ track: MatchedTrack; index: number } | null>(null);
const [rematchQuery, setRematchQuery] = useState('');
const [rematchResults, setRematchResults] = useState<any[]>([]);
const [isSearchingRematch, setIsSearchingRematch] = useState(false);
const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
```

#### New Functions
- `handleOpenRematch()` - Opens rematch modal for a track
- `handleCloseRematch()` - Closes rematch modal
- `handleSearchRematch()` - Searches Plex library for matches
- `handleSelectRematch()` - Selects new match from search results
- `handleDragStart()` - Initiates drag operation
- `handleDragOver()` - Handles drag over events and reordering
- `handleDragEnd()` - Completes drag operation
- `handleExportMissing()` - Exports unmatched tracks to CSV
- `handleConfirmUpdated()` - Creates playlist with edited tracks
- `getScoreColor()` - Returns color based on match score

#### UI Components
- Enhanced review table with all columns
- Manual rematch modal with search
- Filter checkbox and export button
- Drag and drop enabled rows

### Backend Changes

#### `apps/server/src/routes/import.ts`
- Added `POST /api/import/search` endpoint
- Queries user's Plex server for matching tracks
- Returns formatted results with all needed fields

#### `packages/shared/src/types/index.ts`
- Updated `MatchedTrack` interface to include `album?: string` field

## User Experience Flow

1. **Import playlist** → Matching completes → Review screen appears
2. **Review matches**: See all tracks with scores and details
3. **Filter if needed**: Toggle "Show unmatched only" to focus on problems
4. **Reorder tracks**: Drag and drop to change playlist order
5. **Manual rematch**: Click any track to search and select better match
6. **Export missing**: Download CSV of unmatched tracks for reference
7. **Create playlist**: Click "Create Playlist (X)" to finalize

## Match Score Color Coding

- **100%**: Green (`var(--success)`) - Perfect match
- **90-99%**: Light green (`#90EE90`) - Very good match
- **80-89%**: Gold (`#FFD700`) - Good match
- **70-79%**: Orange (`#FFA500`) - Acceptable match
- **<70%**: Red (`var(--error)`) - Poor match
- **Unmatched**: Red with dash (`-`)

## Source → Matched Display

For matched tracks, the Title column shows:
```
Original Title (small, gray)
→ Matched Plex Title (bold, white)
```

For unmatched tracks:
```
Original Title (bold, yellow/warning color)
```

## Files Modified

### Frontend
- ✅ `apps/web/src/pages/ImportPage.tsx` - Complete review screen implementation

### Backend
- ✅ `apps/server/src/routes/import.ts` - Added search endpoint

### Shared
- ✅ `packages/shared/src/types/index.ts` - Updated MatchedTrack type

## Testing Checklist

- [ ] Import a playlist and verify review screen appears
- [ ] Check match scores are displayed correctly with color coding
- [ ] Verify source → matched mapping shows correctly
- [ ] Test drag and drop reordering
- [ ] Test manual rematch modal:
  - [ ] Search functionality
  - [ ] Select new match
  - [ ] Verify score updates to 100%
- [ ] Test "Show unmatched only" filter
- [ ] Test "Export Missing" button
- [ ] Verify playlist creation with edited tracks
- [ ] Test cancel button resets state

## Known Limitations

1. **Drag and drop**: Uses HTML5 Drag API which may have browser-specific behavior
2. **Search results**: Limited to what Plex returns (no pagination in modal)
3. **CSV export**: Basic format, could be enhanced with more fields

## Future Enhancements (Optional)

1. **Bulk operations**: Select multiple tracks for batch rematch
2. **Undo/redo**: Track changes and allow reverting
3. **Save draft**: Save review state and resume later
4. **Advanced search**: Filter search results by artist, album, etc.
5. **Match suggestions**: Show alternative matches for low-score tracks
6. **Keyboard shortcuts**: Arrow keys for navigation, Enter for rematch, etc.

## Conclusion

The import review/edit feature is now fully implemented with all requested functionality matching the desktop app. Users can review, edit, reorder, and manually rematch tracks before creating playlists, providing complete control over the import process.
