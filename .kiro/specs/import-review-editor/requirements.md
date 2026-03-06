# Import Review Editor - Requirements

## Overview
Add an intermediate review/edit screen after playlist matching completes, allowing users to review matches, manually rematch tracks, reorder tracks, and filter results before creating the playlist.

## User Stories

1. As a user, I want to review all matched tracks with their match scores before creating a playlist
2. As a user, I want to manually search and rematch tracks that were matched incorrectly
3. As a user, I want to reorder tracks by dragging and dropping
4. As a user, I want to filter to show only unmatched tracks
5. As a user, I want to export unmatched tracks to a file
6. As a user, I want to see the source track name and the matched Plex track name side-by-side

## Functional Requirements

### FR1: Review Screen Display
- Display playlist name (editable)
- Show match statistics: "X matched / Y unmatched"
- Display all tracks in a table with columns:
  - Drag handle (⋮⋮ icon)
  - Track number (#)
  - Title (source → matched with arrow)
  - Artist
  - Album
  - Format (MP3, FLAC, etc.)
  - Match Score (percentage with color coding)
- Color code match scores:
  - Green (100%): Perfect match
  - Yellow (80-99%): Good match
  - Red (<80% or unmatched): Poor/no match

### FR2: Manual Rematch
- Click on any track row to open rematch modal
- Modal contains:
  - Search input field
  - Search button
  - Results table showing: Title, Artist, Album, Format, Bitrate
  - Select button for each result
- Search queries Plex library in real-time
- Selecting a new match updates the track and recalculates score
- Close modal returns to review screen

### FR3: Drag and Drop Reordering
- Drag handle visible on each row
- Dragging a row shows visual feedback (opacity, cursor)
- Drop zones appear between rows
- Dropping reorders tracks in the list
- Track numbers update automatically

### FR4: Filter Controls
- Checkbox: "Show unmatched only"
- When checked, hide all matched tracks
- Match statistics remain visible
- Unchecking shows all tracks again

### FR5: Export Missing Tracks
- Button: "Export Missing (X)"
- Clicking downloads a CSV file with unmatched tracks
- CSV contains: Title, Artist, Album, Source
- Filename: `{playlist-name}-missing-tracks.csv`

### FR6: Create Playlist
- Button: "Create Playlist (X tracks)"
- Only includes matched tracks
- Creates playlist in Plex
- Navigates to playlists page on success

## Non-Functional Requirements

### NFR1: Performance
- Table should render smoothly with 100+ tracks
- Drag and drop should feel responsive
- Search should return results within 1 second

### NFR2: Usability
- Match desktop app UX exactly
- Clear visual feedback for all interactions
- Keyboard shortcuts for common actions

### NFR3: Data Integrity
- All track metadata preserved during edits
- No data loss if user navigates away
- Undo/redo not required (can be added later)

## Technical Requirements

### Backend
- Add search endpoint: `POST /api/plex/search`
  - Parameters: query (string), libraryId (optional)
  - Returns: Array of tracks with full metadata
- Ensure all track fields are returned in import result

### Frontend
- Use HTML5 Drag and Drop API (no external library needed)
- State management for editable track list
- CSV export using browser download API
- Modal component for rematch

## Acceptance Criteria

1. After import completes, review screen is shown (not auto-create)
2. All tracks display with correct match scores
3. Clicking a track opens rematch modal
4. Searching in modal returns Plex tracks
5. Selecting a new match updates the track
6. Dragging and dropping reorders tracks
7. "Show unmatched only" filters the table
8. "Export Missing" downloads CSV file
9. "Create Playlist" creates playlist with matched tracks only
10. Layout matches desktop app screenshot

## Out of Scope (Future Enhancements)
- Bulk rematch (select multiple tracks)
- Undo/redo functionality
- Save draft (resume later)
- Keyboard shortcuts
- Advanced search filters
