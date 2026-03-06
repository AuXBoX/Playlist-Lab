# Library Scan Feature - Update

## Changes Made

### Problem
The folder browsing feature wasn't working because:
1. The `/library/sections/{id}/folder` endpoint was returning no directories
2. Plex's folder browsing API is complex and requires specific parameters
3. The approach of browsing subdirectories wasn't reliable

### Solution
Simplified the folder scanning feature to use manual path entry instead of folder browsing:

1. **Changed `getLibraryFolders()` in `apps/server/src/services/plex.ts`**:
   - Now uses `/library/sections/{libraryId}` endpoint to get library section details
   - Extracts the `Location` array which contains configured folder paths
   - This is more reliable and matches how Plex stores library locations

2. **Removed folder browsing functionality**:
   - Removed `browseFolderContents()` method from PlexClient
   - Removed `/api/servers/browse-folder` endpoint
   - Removed `FolderBrowserModal` component from SettingsPage

3. **Updated UI in `apps/web/src/pages/SettingsPage.tsx`**:
   - Changed folder input from read-only to editable text field
   - Shows library root folders as reference
   - Users can now manually type or paste folder paths
   - Removed "Browse Folders..." button
   - Kept "Scan Folder" button for triggering scans

## How It Works Now

### Full Library Scan
- Click "Scan Entire Library" button
- Triggers Plex to scan all folders in the library

### Folder-Specific Scan
1. The UI displays your library's root folders as reference (e.g., `/music` or `C:\Music`)
2. User types the full path to a subfolder (e.g., `/music/Gracie Abrams` or `C:\Music\Gracie Abrams`)
3. Click "Scan Folder" button
4. Plex scans only that specific folder

## Benefits

1. **Simpler**: No complex folder browsing logic
2. **More reliable**: Uses Plex's documented library section endpoint
3. **Flexible**: Users can scan any folder path, not just browsable ones
4. **Faster**: No need to navigate through folder hierarchy
5. **Works with all path formats**: Unix paths (`/music/artist`) and Windows paths (`C:\Music\Artist`)

## API Endpoints

### Get Library Folders
```http
GET /api/servers/library-folders
```

Returns the configured root folders for the selected library:
```json
{
  "folders": [
    { "path": "/music", "accessible": true },
    { "path": "/music2", "accessible": true }
  ]
}
```

### Scan Library
```http
POST /api/servers/scan-library
Content-Type: application/json

{
  "path": "/music/Gracie Abrams"  // Optional - omit for full library scan
}
```

Response:
```json
{
  "success": true,
  "message": "Scanning folder \"/music/Gracie Abrams\". This may take a few minutes."
}
```

## User Instructions

1. Go to Settings page
2. Select your Plex server and music library
3. Scroll to "Library Scan" section
4. For full scan: Click "Scan Entire Library"
5. For folder scan:
   - Look at the library root folders shown
   - Type the full path to the folder you want to scan
   - Click "Scan Folder"

## Example Paths

**Linux/macOS:**
- `/music/Gracie Abrams`
- `/mnt/media/music/Various Artists`
- `/home/user/Music/New Albums`

**Windows:**
- `C:\Music\Gracie Abrams`
- `D:\Media\Music\Various Artists`
- `\\NAS\Music\New Albums`

## Technical Notes

- Plex processes scans asynchronously in the background
- Large folders may take several minutes to scan
- Folder-specific scans are much faster than full library scans
- The path must be within one of the library's configured root folders
- Plex will validate the path and return an error if it's not accessible
