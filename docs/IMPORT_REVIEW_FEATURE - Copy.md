# Import Review/Edit Feature - Implementation

## Overview
Add an intermediate review/edit screen after playlist matching completes, allowing users to review matches, manually rematch tracks, reorder tracks, and filter results before creating the playlist.

## Features

### 1. Review Screen Layout
- [x] Show playlist name (editable)
- [x] Display match statistics (X matched / Y unmatched)
- [ ] Table with columns: #, Drag Handle, Title, Artist, Album, Format, Score
- [ ] Show source track → matched Plex track with arrow
- [ ] Color-coded match scores (green for 100%, yellow for <100%, red for unmatched)
- [ ] Checkbox: "Show unmatched only"
- [ ] Buttons: "Export Missing", "Create Playlist", "Cancel"

### 2. Drag and Drop Reordering
- [ ] Drag handle icon on each row
- [ ] Visual feedback during drag (row opacity, cursor)
- [ ] Drop zones between rows
- [ ] Update track order in state

### 3. Manual Rematch
- [ ] Click on a track row to open rematch modal
- [ ] Search input for Plex library
- [ ] Display search results with track details
- [ ] Select new match from results
- [ ] Update track in review list
- [ ] Show updated match score

### 4. Filter Controls
- [ ] "Show unmatched only" checkbox
- [ ] Filter table to show only unmatched tracks
- [ ] Update match statistics display

### 5. Export Missing Tracks
- [ ] Generate CSV/JSON file with unmatched tracks
- [ ] Include: title, artist, album, source
- [ ] Download file to user's computer

### 6. Backend Support
- [ ] Search endpoint for manual rematch
- [ ] Return track details with scores

## Implementation Steps

### Step 1: Modify Import Flow
- Change `handleImport` to show review screen instead of auto-creating
- Pass import result to review screen

### Step 2: Create Review Screen Component
- New state for editable tracks
- Table layout matching desktop app
- Match score display

### Step 3: Add Drag and Drop
- Install/use drag-drop library or HTML5 drag API
- Implement reordering logic

### Step 4: Manual Rematch Modal
- Search modal component
- Backend search endpoint
- Update track logic

### Step 5: Filter and Export
- Filter checkbox logic
- Export to CSV/JSON

## Files to Modify

### Frontend
- `apps/web/src/pages/ImportPage.tsx` - Add review screen state and UI
- `apps/web/src/components/RematchModal.tsx` - New component for manual rematch

### Backend
- `apps/server/src/routes/import.ts` - Add search endpoint for rematch
- `apps/server/src/services/plex.ts` - Ensure search returns all needed fields

## Progress
- [x] Planning complete
- [ ] Step 1: Modify import flow
- [ ] Step 2: Create review screen
- [ ] Step 3: Add drag and drop
- [ ] Step 4: Manual rematch
- [ ] Step 5: Filter and export
- [ ] Testing
- [ ] Complete

## Notes
- Keep it simple (KISS principle)
- Match desktop app UX exactly
- Ensure all track metadata is preserved during edits
