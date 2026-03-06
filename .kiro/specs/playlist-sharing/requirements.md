# Playlist Management & Sharing - Requirements

## Overview
Add a comprehensive playlist management section where users can view, organize, and share their Plex playlists with other Playlist Lab users. Enable easy playlist discovery and collaboration between users on the same server.

## Goals
- Provide a centralized view of all user playlists
- Enable easy playlist sharing between users
- Support playlist discovery (browse other users' shared playlists)
- Allow users to copy/import shared playlists to their own Plex library
- Maintain playlist metadata and track information

## User Stories

### Playlist Management
1. As a user, I want to see all my Plex playlists in one place so I can manage them easily
2. As a user, I want to see playlist details (track count, duration, last updated) at a glance
3. As a user, I want to search and filter my playlists
4. As a user, I want to see which playlists I've created vs imported from others
5. As a user, I want to delete playlists I no longer need

### Playlist Sharing
6. As a user, I want to mark playlists as "shared" so other users can discover them
7. As a user, I want to unshare playlists to make them private again
8. As a user, I want to browse playlists shared by other users on the server
9. As a user, I want to see who created/shared a playlist
10. As a user, I want to copy a shared playlist to my own Plex library
11. As a user, I want to see how many users have copied my shared playlists

### Playlist Discovery
12. As a user, I want to see recently shared playlists
13. As a user, I want to see popular playlists (most copied)
14. As a user, I want to search for playlists by name or creator
15. As a user, I want to preview a playlist's tracks before copying it

## Functional Requirements

### Playlist Management View
- Display all user's Plex playlists in a grid or list view
- Show playlist cover art (composite image from Plex)
- Display playlist metadata:
  - Name
  - Track count
  - Total duration
  - Created date
  - Last updated date
  - Sharing status (private/shared)
  - Source (created by user, imported from another user, or from external source)
- Support search by playlist name
- Support filtering by:
  - Sharing status (all, private, shared)
  - Source (my playlists, imported, external)
- Refresh playlists from Plex on demand
- Delete playlist action (with confirmation)

### Playlist Sharing
- Toggle sharing status for any playlist
- Shared playlists are visible to all users on the same Playlist Lab server
- Sharing metadata includes:
  - Original creator username
  - Share date
  - Number of times copied
  - Description (optional)
- Unsharing a playlist doesn't affect copies already made by other users

### Shared Playlists Browser
- Separate view for browsing shared playlists from other users
- Display shared playlists with:
  - Playlist name and cover art
  - Creator username
  - Track count and duration
  - Share date
  - Copy count
  - Description
- Filter by creator
- Sort by:
  - Recently shared
  - Most popular (copy count)
  - Alphabetical
- Search by playlist name or creator

### Playlist Copying
- Copy button on shared playlists
- Copying process:
  1. Fetch track list from shared playlist
  2. Match tracks in user's Plex library
  3. Create new playlist in user's Plex with matched tracks
  4. Show match statistics (X of Y tracks matched)
  5. Store metadata linking to original shared playlist
- Option to customize playlist name before copying
- Handle missing tracks gracefully (skip or show warning)

## Non-Functional Requirements

### Performance
- Playlist list should load in < 2 seconds
- Shared playlist browser should support pagination (50 playlists per page)
- Playlist copying should provide progress feedback

### Security
- Users can only share their own playlists
- Users can only delete their own playlists
- Shared playlist data is read-only for non-owners
- No access to other users' private playlists

### Data Privacy
- Only playlist metadata and track information is shared
- User's Plex server credentials are never shared
- Playlist sharing is opt-in per playlist

### Usability
- Clear visual distinction between private and shared playlists
- Intuitive share/unshare toggle
- Confirmation dialogs for destructive actions (delete, unshare)
- Loading states for async operations
- Error messages for failed operations

## Technical Considerations

### Database Schema
- `shared_playlists` table:
  - id (primary key)
  - user_id (foreign key to users)
  - plex_playlist_id (Plex rating key)
  - playlist_name
  - description (optional)
  - track_count
  - duration_ms
  - cover_url (optional)
  - shared_at (timestamp)
  - updated_at (timestamp)
  - copy_count (integer, default 0)

- `playlist_copies` table:
  - id (primary key)
  - shared_playlist_id (foreign key to shared_playlists)
  - user_id (foreign key to users)
  - plex_playlist_id (user's copy in their Plex)
  - copied_at (timestamp)
  - tracks_matched (integer)
  - tracks_total (integer)

- `playlist_tracks` table (for shared playlists):
  - id (primary key)
  - shared_playlist_id (foreign key)
  - track_title
  - track_artist
  - track_album
  - track_duration_ms
  - track_index (position in playlist)

### API Endpoints
- `GET /api/playlists/mine` - Get user's playlists
- `GET /api/playlists/shared` - Get all shared playlists
- `POST /api/playlists/:id/share` - Share a playlist
- `DELETE /api/playlists/:id/share` - Unshare a playlist
- `GET /api/playlists/shared/:id` - Get shared playlist details
- `POST /api/playlists/shared/:id/copy` - Copy shared playlist to user's Plex
- `DELETE /api/playlists/:id` - Delete user's playlist

### Integration with Plex
- Use existing PlexClient to fetch user's playlists
- Use existing PlexClient to create playlists
- Store Plex playlist IDs for synchronization
- Handle Plex API rate limits

## Out of Scope (Future Enhancements)
- Collaborative playlists (multiple users editing same playlist)
- Playlist comments or ratings
- Playlist categories/tags
- Playlist versioning/history
- Export playlists to external formats (M3U, etc.)
- Playlist recommendations based on user preferences
- Public playlist sharing (outside the server)

## Success Metrics
- Number of playlists shared per user
- Number of playlist copies made
- User engagement with shared playlists feature
- Time spent in playlist management section
