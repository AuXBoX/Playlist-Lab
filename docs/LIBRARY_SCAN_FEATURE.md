# Library Scan Feature

## Overview
Added the ability to scan your Plex music library for new or changed files directly from Playlist Lab.

## Features

### 1. Full Library Scan
- Scans the entire music library for new/changed files
- Accessible from Settings page
- One-click operation

### 2. Folder-Specific Scan
- Browse library folder structure
- Select specific folders to scan
- Faster than full library scan when you know which folder changed
- Shows folder accessibility status

## Usage

1. Go to **Settings** page
2. Scroll to the **Library Scan** section (appears after selecting a library)
3. Choose one of two options:
   - **Scan Entire Library**: Scans all folders in your library
   - **Scan Specific Folder**: Select a folder from the dropdown and scan only that folder

## Technical Implementation

### Backend (Server)

**Plex Service** (`apps/server/src/services/plex.ts`):
- `scanLibrary(libraryId, path?)`: Triggers library scan
  - Without `path`: Scans entire library
  - With `path`: Scans specific folder
- `getLibraryFolders(libraryId)`: Returns configured library folders

**API Endpoints** (`apps/server/src/routes/servers.ts`):
- `GET /api/servers/library-folders`: Get library folder paths
- `POST /api/servers/scan-library`: Trigger scan (optional `path` in body)

### Frontend (Web)

**Settings Page** (`apps/web/src/pages/SettingsPage.tsx`):
- Added `LibraryScanSection` component
- Shows scan buttons and folder selector
- Displays success/error messages
- Auto-loads library folders on mount

## API Usage

### Get Library Folders
```http
GET /api/servers/library-folders
```

Response:
```json
{
  "folders": [
    { "path": "/music/library1", "accessible": true },
    { "path": "/music/library2", "accessible": true }
  ]
}
```

### Scan Entire Library
```http
POST /api/servers/scan-library
Content-Type: application/json

{}
```

### Scan Specific Folder
```http
POST /api/servers/scan-library
Content-Type: application/json

{
  "path": "/music/library1/Gracie Abrams"
}
```

Response:
```json
{
  "success": true,
  "message": "Scanning folder \"/music/library1/Gracie Abrams\". This may take a few minutes."
}
```

## Use Cases

1. **Added new music files**: Scan the specific artist/album folder
2. **Fixed metadata**: Scan the affected folder to update Plex
3. **General maintenance**: Full library scan to catch any changes
4. **Troubleshooting**: When tracks don't appear in search, trigger a scan

## Notes

- Scans are asynchronous - Plex processes them in the background
- Large libraries may take several minutes to scan
- Folder-specific scans are much faster than full library scans
- Only accessible folders can be scanned
