# Playlist Management & Sharing - Design

## Architecture Overview

### Component Structure
```
┌─────────────────────────────────────────────────────────────┐
│                     Web Application                          │
├─────────────────────────────────────────────────────────────┤
│  MyPlaylistsPage          │  SharedPlaylistsPage            │
│  - List user playlists    │  - Browse shared playlists      │
│  - Share/unshare toggle   │  - Copy to my library           │
│  - Delete playlists       │  - Preview tracks               │
│  - Refresh from Plex      │  - Search & filter              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
├─────────────────────────────────────────────────────────────┤
│  /api/playlists/*         │  Playlist management endpoints  │
│  /api/playlists/shared/*  │  Shared playlist endpoints      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                              │
├─────────────────────────────────────────────────────────────┤
│  PlaylistService          │  SharedPlaylistService          │
│  - Sync with Plex         │  - Share/unshare logic          │
│  - CRUD operations        │  - Copy playlist logic          │
│                           │  - Track matching               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                 │
├─────────────────────────────────────────────────────────────┤
│  Database (SQLite)        │  Plex API                       │
│  - shared_playlists       │  - Get playlists                │
│  - playlist_copies        │  - Get playlist tracks          │
│  - playlist_tracks        │  - Create playlist              │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### shared_playlists
```sql
CREATE TABLE shared_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plex_playlist_id TEXT NOT NULL,
  playlist_name TEXT NOT NULL,
  description TEXT,
  track_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  cover_url TEXT,
  shared_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  copy_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, plex_playlist_id)
);

CREATE INDEX idx_shared_playlists_user ON shared_playlists(user_id);
CREATE INDEX idx_shared_playlists_shared_at ON shared_playlists(shared_at DESC);
CREATE INDEX idx_shared_playlists_copy_count ON shared_playlists(copy_count DESC);
```

### playlist_copies
```sql
CREATE TABLE playlist_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shared_playlist_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  plex_playlist_id TEXT NOT NULL,
  copied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tracks_matched INTEGER NOT NULL DEFAULT 0,
  tracks_total INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (shared_playlist_id) REFERENCES shared_playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(shared_playlist_id, user_id)
);

CREATE INDEX idx_playlist_copies_user ON playlist_copies(user_id);
CREATE INDEX idx_playlist_copies_shared ON playlist_copies(shared_playlist_id);
```

### playlist_tracks
```sql
CREATE TABLE playlist_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shared_playlist_id INTEGER NOT NULL,
  track_title TEXT NOT NULL,
  track_artist TEXT NOT NULL,
  track_album TEXT,
  track_duration_ms INTEGER,
  track_index INTEGER NOT NULL,
  FOREIGN KEY (shared_playlist_id) REFERENCES shared_playlists(id) ON DELETE CASCADE
);

CREATE INDEX idx_playlist_tracks_shared ON playlist_tracks(shared_playlist_id, track_index);
```

## API Endpoints

### GET /api/playlists/mine
Get user's playlists from Plex with sharing status.

**Response:**
```json
{
  "playlists": [
    {
      "plexId": "12345",
      "name": "Summer Vibes 2024",
      "trackCount": 45,
      "duration": 10800000,
      "coverUrl": "/library/metadata/12345/composite/...",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-02-20T15:45:00Z",
      "isShared": true,
      "sharedAt": "2024-02-01T12:00:00Z",
      "copyCount": 5,
      "description": "Perfect summer playlist"
    }
  ]
}
```

### POST /api/playlists/:plexId/share
Share a playlist.

**Request:**
```json
{
  "description": "My favorite summer tracks"
}
```

**Response:**
```json
{
  "success": true,
  "sharedPlaylist": {
    "id": 123,
    "plexId": "12345",
    "name": "Summer Vibes 2024",
    "sharedAt": "2024-02-01T12:00:00Z"
  }
}
```

### DELETE /api/playlists/:plexId/share
Unshare a playlist.

**Response:**
```json
{
  "success": true,
  "message": "Playlist unshared successfully"
}
```

### GET /api/playlists/shared
Get all shared playlists from other users.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)
- `sort` (recent|popular|name)
- `search` (optional)
- `creator` (optional user ID filter)

**Response:**
```json
{
  "playlists": [
    {
      "id": 123,
      "name": "Summer Vibes 2024",
      "creator": {
        "id": 5,
        "username": "john_doe"
      },
      "trackCount": 45,
      "duration": 10800000,
      "coverUrl": "/api/playlists/shared/123/cover",
      "sharedAt": "2024-02-01T12:00:00Z",
      "copyCount": 5,
      "description": "Perfect summer playlist",
      "isCopied": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

### GET /api/playlists/shared/:id
Get shared playlist details including tracks.

**Response:**
```json
{
  "id": 123,
  "name": "Summer Vibes 2024",
  "creator": {
    "id": 5,
    "username": "john_doe"
  },
  "trackCount": 45,
  "duration": 10800000,
  "coverUrl": "/api/playlists/shared/123/cover",
  "sharedAt": "2024-02-01T12:00:00Z",
  "copyCount": 5,
  "description": "Perfect summer playlist",
  "isCopied": true,
  "tracks": [
    {
      "title": "Blinding Lights",
      "artist": "The Weeknd",
      "album": "After Hours",
      "duration": 200000,
      "index": 1
    }
  ]
}
```

### POST /api/playlists/shared/:id/copy
Copy a shared playlist to user's Plex library.

**Request:**
```json
{
  "playlistName": "Summer Vibes 2024 (Copy)"
}
```

**Response:**
```json
{
  "success": true,
  "plexPlaylistId": "67890",
  "tracksMatched": 42,
  "tracksTotal": 45,
  "missingTracks": [
    {
      "title": "Some Track",
      "artist": "Some Artist",
      "album": "Some Album"
    }
  ]
}
```

### DELETE /api/playlists/:plexId
Delete a playlist from user's Plex library.

**Response:**
```json
{
  "success": true,
  "message": "Playlist deleted successfully"
}
```

## UI Components

### MyPlaylistsPage
```
┌─────────────────────────────────────────────────────────────┐
│  My Playlists                                    [Refresh]   │
├─────────────────────────────────────────────────────────────┤
│  [Search playlists...]                                       │
│  Filters: [All] [Private] [Shared]                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  [Cover] │  │  [Cover] │  │  [Cover] │                  │
│  │          │  │          │  │          │                  │
│  │ Summer   │  │ Workout  │  │ Chill    │                  │
│  │ Vibes    │  │ Mix      │  │ Evening  │                  │
│  │ 45 tracks│  │ 32 tracks│  │ 28 tracks│                  │
│  │ 3h 0m    │  │ 2h 15m   │  │ 1h 50m   │                  │
│  │ [Shared] │  │ [Share]  │  │ [Share]  │                  │
│  │ 5 copies │  │          │  │          │                  │
│  │ [Delete] │  │ [Delete] │  │ [Delete] │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### SharedPlaylistsPage
```
┌─────────────────────────────────────────────────────────────┐
│  Shared Playlists                                            │
├─────────────────────────────────────────────────────────────┤
│  [Search playlists or creators...]                           │
│  Sort by: [Recently Shared ▼]                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  [Cover] │  │  [Cover] │  │  [Cover] │                  │
│  │          │  │          │  │          │                  │
│  │ Summer   │  │ Rock     │  │ Jazz     │                  │
│  │ Vibes    │  │ Classics │  │ Essentials│                 │
│  │ by john  │  │ by sarah │  │ by mike  │                  │
│  │ 45 tracks│  │ 60 tracks│  │ 38 tracks│                  │
│  │ 3h 0m    │  │ 4h 30m   │  │ 2h 20m   │                  │
│  │ 5 copies │  │ 12 copies│  │ 3 copies │                  │
│  │ [Preview]│  │ [Preview]│  │ [Preview]│                  │
│  │ [✓Copied]│  │ [Copy]   │  │ [Copy]   │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Playlist Preview Modal
```
┌─────────────────────────────────────────────────────────────┐
│  Summer Vibes 2024                                      [×]  │
│  by john_doe • Shared Feb 1, 2024 • 5 copies                │
├─────────────────────────────────────────────────────────────┤
│  Description: Perfect summer playlist                        │
│                                                              │
│  45 tracks • 3h 0m                                           │
│                                                              │
│  Tracks:                                                     │
│  1. Blinding Lights - The Weeknd (3:20)                     │
│  2. Levitating - Dua Lipa (3:23)                            │
│  3. Good 4 U - Olivia Rodrigo (2:58)                        │
│  ...                                                         │
│                                                              │
│  [Copy to My Library]                                        │
└─────────────────────────────────────────────────────────────┘
```

### Copy Playlist Dialog
```
┌─────────────────────────────────────────────────────────────┐
│  Copy Playlist                                          [×]  │
├─────────────────────────────────────────────────────────────┤
│  Playlist Name:                                              │
│  [Summer Vibes 2024 (Copy)                            ]     │
│                                                              │
│  This will create a new playlist in your Plex library.      │
│  Tracks will be matched against your library.               │
│                                                              │
│  [Cancel]  [Copy Playlist]                                  │
└─────────────────────────────────────────────────────────────┘
```

## Service Layer

### PlaylistService
```typescript
class PlaylistService {
  // Get user's playlists from Plex with sharing status
  async getUserPlaylists(userId: number): Promise<UserPlaylist[]>
  
  // Refresh playlists from Plex
  async refreshPlaylists(userId: number): Promise<void>
  
  // Delete playlist from Plex
  async deletePlaylist(userId: number, plexPlaylistId: string): Promise<void>
}
```

### SharedPlaylistService
```typescript
class SharedPlaylistService {
  // Share a playlist
  async sharePlaylist(
    userId: number, 
    plexPlaylistId: string, 
    description?: string
  ): Promise<SharedPlaylist>
  
  // Unshare a playlist
  async unsharePlaylist(userId: number, plexPlaylistId: string): Promise<void>
  
  // Get all shared playlists
  async getSharedPlaylists(
    userId: number,
    options: {
      page: number;
      limit: number;
      sort: 'recent' | 'popular' | 'name';
      search?: string;
      creator?: number;
    }
  ): Promise<{ playlists: SharedPlaylist[]; pagination: Pagination }>
  
  // Get shared playlist details
  async getSharedPlaylistDetails(
    userId: number,
    sharedPlaylistId: number
  ): Promise<SharedPlaylistWithTracks>
  
  // Copy shared playlist to user's Plex
  async copySharedPlaylist(
    userId: number,
    sharedPlaylistId: number,
    playlistName: string
  ): Promise<CopyResult>
  
  // Store playlist tracks when sharing
  private async storePlaylistTracks(
    sharedPlaylistId: number,
    plexPlaylistId: string,
    plexClient: PlexClient
  ): Promise<void>
  
  // Match tracks in user's library
  private async matchTracks(
    userId: number,
    tracks: PlaylistTrack[]
  ): Promise<MatchResult[]>
}
```

## Implementation Flow

### Sharing a Playlist
1. User clicks "Share" on a playlist
2. Optional: User enters description
3. Frontend calls `POST /api/playlists/:plexId/share`
4. Backend:
   - Fetch playlist details from Plex
   - Fetch all tracks from playlist
   - Create entry in `shared_playlists` table
   - Store tracks in `playlist_tracks` table
   - Return success response
5. Frontend updates UI to show "Shared" status

### Copying a Shared Playlist
1. User browses shared playlists
2. User clicks "Preview" to see tracks
3. User clicks "Copy to My Library"
4. User optionally customizes playlist name
5. Frontend calls `POST /api/playlists/shared/:id/copy`
6. Backend:
   - Fetch tracks from `playlist_tracks` table
   - Match each track in user's Plex library using existing matching logic
   - Create new playlist in user's Plex with matched tracks
   - Create entry in `playlist_copies` table
   - Increment `copy_count` in `shared_playlists`
   - Return match statistics
7. Frontend shows success message with match statistics
8. If tracks missing, show list of unmatched tracks

## Error Handling

### Common Errors
- **Playlist not found in Plex**: Show error, suggest refreshing
- **Plex API error**: Show generic error, log details
- **Already shared**: Show message that playlist is already shared
- **No tracks matched**: Warn user before creating empty playlist
- **Playlist name conflict**: Suggest alternative name

### Validation
- Playlist name: 1-255 characters
- Description: 0-1000 characters
- User can only share their own playlists
- User can only delete their own playlists
- User cannot copy their own shared playlists

## Performance Considerations

### Caching
- Cache user's playlist list for 5 minutes
- Cache shared playlists list for 1 minute
- Invalidate cache on share/unshare/delete actions

### Pagination
- Limit shared playlists to 50 per page
- Use cursor-based pagination for large datasets

### Optimization
- Lazy load playlist covers (load on scroll)
- Batch track matching during copy (process in chunks of 50)
- Show progress indicator for long-running operations

## Security Considerations

### Authorization
- Verify user owns playlist before sharing/unsharing/deleting
- Verify user has access to shared playlist before copying
- Rate limit copy operations (max 10 per hour per user)

### Data Validation
- Sanitize user input (playlist names, descriptions)
- Validate Plex playlist IDs
- Prevent SQL injection in search queries

### Privacy
- Don't expose user's Plex server details
- Don't expose user's Plex token
- Only share playlist metadata, not user data
