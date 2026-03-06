# Playlist Lab Web Server - API Documentation

## Overview

The Playlist Lab Web Server provides a RESTful API for managing Plex playlists, generating personalized mixes, and scheduling automated playlist operations. All endpoints return JSON responses and require authentication except for the auth endpoints.

**Base URL**: `http://localhost:3000/api` (development)  
**Production URL**: `https://your-domain.com/api`

## Table of Contents

1. [Authentication](#authentication)
2. [Error Handling](#error-handling)
3. [Rate Limiting](#rate-limiting)
4. [Endpoints](#endpoints)
   - [Authentication](#authentication-endpoints)
   - [Servers](#server-endpoints)
   - [Settings](#settings-endpoints)
   - [Import](#import-endpoints)
   - [Playlists](#playlist-endpoints)
   - [Mixes](#mix-endpoints)
   - [Schedules](#schedule-endpoints)
   - [Missing Tracks](#missing-tracks-endpoints)
   - [Discovery](#discovery-endpoints)
   - [Admin](#admin-endpoints)
   - [Migration](#migration-endpoints)

---

## Authentication

Most API endpoints require authentication via session cookies. The authentication flow uses Plex's PIN-based OAuth.

### Authentication Flow

1. **Start Auth**: Call `POST /api/auth/start` to get a PIN code
2. **User Authorization**: Direct user to Plex auth URL
3. **Poll for Completion**: Call `POST /api/auth/poll` until authenticated
4. **Session Created**: Session cookie is set automatically

### Session Management

- Sessions expire after 30 days of inactivity
- Session cookies are httpOnly and secure (in production)
- Use `GET /api/auth/me` to check session validity

---

## Error Handling

All errors follow a consistent JSON format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "statusCode": 400
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_REQUIRED` | 401 | No session token provided |
| `AUTH_INVALID` | 401 | Invalid or expired session |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `ADMIN_REQUIRED` | 403 | Admin privileges required |
| `INVALID_INPUT` | 400 | Invalid request parameters |
| `MISSING_FIELD` | 400 | Required field missing |
| `NOT_FOUND` | 404 | Resource not found |
| `PLEX_UNREACHABLE` | 502 | Cannot connect to Plex server |
| `SCRAPING_FAILED` | 502 | External service unavailable |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limiting

- **Limit**: 100 requests per minute per IP address
- **Response**: 429 Too Many Requests when exceeded
- **Headers**: 
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

---

## Endpoints

### Authentication Endpoints

#### POST /api/auth/start

Initiate Plex PIN-based OAuth flow.

**Authentication**: None required

**Request Body**: None

**Response**:
```json
{
  "id": 12345,
  "code": "ABCD1234",
  "authUrl": "https://app.plex.tv/auth#?clientID=..."
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/auth/start
```

---

#### POST /api/auth/poll

Poll for PIN authentication completion.

**Authentication**: None required

**Request Body**:
```json
{
  "pinId": 12345,
  "code": "ABCD1234"
}
```

**Response** (Not yet authenticated):
```json
{
  "authenticated": false
}
```

**Response** (Authenticated):
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "plexUserId": "123456",
    "username": "john_doe",
    "thumb": "https://plex.tv/users/..."
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/auth/poll \
  -H "Content-Type: application/json" \
  -d '{"pinId": 12345, "code": "ABCD1234"}'
```

---

#### POST /api/auth/logout

Destroy user session and log out.

**Authentication**: Required

**Request Body**: None

**Response**:
```json
{
  "success": true
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: connect.sid=..."
```

---

#### GET /api/auth/me

Get current authenticated user information.

**Authentication**: Required

**Response**:
```json
{
  "id": 1,
  "plexUserId": "123456",
  "username": "john_doe",
  "thumb": "https://plex.tv/users/..."
}
```

**Example**:
```bash
curl http://localhost:3000/api/auth/me \
  -H "Cookie: connect.sid=..."
```

---

### Server Endpoints

#### GET /api/servers

Get user's available Plex servers.

**Authentication**: Required

**Response**:
```json
{
  "servers": [
    {
      "name": "Home Server",
      "clientIdentifier": "abc123",
      "connections": [
        {
          "uri": "http://192.168.1.100:32400",
          "local": true
        },
        {
          "uri": "https://12345.plex.direct:32400",
          "local": false
        }
      ]
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3000/api/servers \
  -H "Cookie: connect.sid=..."
```

---

#### POST /api/servers/select

Select and save user's Plex server configuration.

**Authentication**: Required

**Request Body**:
```json
{
  "serverName": "Home Server",
  "serverClientId": "abc123",
  "serverUrl": "http://192.168.1.100:32400",
  "libraryId": "1",
  "libraryName": "Music"
}
```

**Response**:
```json
{
  "server": {
    "id": 1,
    "user_id": 1,
    "server_name": "Home Server",
    "server_client_id": "abc123",
    "server_url": "http://192.168.1.100:32400",
    "library_id": "1",
    "library_name": "Music"
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/servers/select \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "serverName": "Home Server",
    "serverClientId": "abc123",
    "serverUrl": "http://192.168.1.100:32400",
    "libraryId": "1",
    "libraryName": "Music"
  }'
```

---

#### GET /api/servers/libraries

Get music libraries from selected Plex server.

**Authentication**: Required

**Response**:
```json
{
  "libraries": [
    {
      "key": "1",
      "title": "Music",
      "type": "artist"
    },
    {
      "key": "2",
      "title": "Classical Music",
      "type": "artist"
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3000/api/servers/libraries \
  -H "Cookie: connect.sid=..."
```

---

### Settings Endpoints

#### GET /api/settings

Get user settings including matching and mix generation settings.

**Authentication**: Required

**Response**:
```json
{
  "settings": {
    "country": "US",
    "matchingSettings": {
      "minMatchScore": 0.7,
      "stripParentheses": true,
      "stripBrackets": true,
      "useFirstArtistOnly": false,
      "ignoreFeaturedArtists": true,
      "ignoreRemixInfo": true,
      "ignoreVersionInfo": true,
      "preferNonCompilation": true,
      "penalizeMonoVersions": true,
      "penalizeLiveVersions": true,
      "preferHigherRated": true,
      "minRatingForMatch": 0,
      "autoCompleteOnPerfectMatch": false
    },
    "mixSettings": {
      "weeklyMix": {
        "topArtists": 5,
        "tracksPerArtist": 10
      },
      "dailyMix": {
        "recentTracks": 10,
        "relatedTracks": 15,
        "rediscoveryTracks": 10,
        "rediscoveryDays": 30
      },
      "timeCapsule": {
        "trackCount": 50,
        "daysAgo": 90,
        "maxPerArtist": 3
      },
      "newMusic": {
        "albumCount": 10,
        "tracksPerAlbum": 3
      }
    }
  }
}
```

**Example**:
```bash
curl http://localhost:3000/api/settings \
  -H "Cookie: connect.sid=..."
```

---

#### PUT /api/settings

Update user settings.

**Authentication**: Required

**Request Body**:
```json
{
  "country": "US",
  "matchingSettings": {
    "minMatchScore": 0.8
  },
  "mixSettings": {
    "weeklyMix": {
      "topArtists": 10
    }
  }
}
```

**Response**:
```json
{
  "settings": {
    "country": "US",
    "matchingSettings": { ... },
    "mixSettings": { ... }
  }
}
```

**Example**:
```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{"country": "US"}'
```

---

#### PUT /api/settings/matching

Update matching settings only.

**Authentication**: Required

**Request Body**:
```json
{
  "matchingSettings": {
    "minMatchScore": 0.8,
    "stripParentheses": true
  }
}
```

**Response**:
```json
{
  "settings": {
    "country": "US",
    "matchingSettings": { ... },
    "mixSettings": { ... }
  }
}
```

---

#### PUT /api/settings/mixes

Update mix generation settings only.

**Authentication**: Required

**Request Body**:
```json
{
  "mixSettings": {
    "weeklyMix": {
      "topArtists": 10,
      "tracksPerArtist": 15
    }
  }
}
```

**Response**:
```json
{
  "settings": {
    "country": "US",
    "matchingSettings": { ... },
    "mixSettings": { ... }
  }
}
```

---

### Import Endpoints

All import endpoints follow the same pattern with different sources.

#### POST /api/import/spotify

Import a Spotify playlist.

**Authentication**: Required

**Request Body**:
```json
{
  "url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
  "serverUrl": "http://192.168.1.100:32400",
  "plexToken": "your-plex-token",
  "libraryId": "1"
}
```

**Response**:
```json
{
  "success": true,
  "playlist": {
    "name": "Today's Top Hits",
    "source": "spotify",
    "matchedCount": 45,
    "unmatchedCount": 5,
    "totalTracks": 50
  },
  "matched": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "matched": true,
      "plexRatingKey": "12345",
      "plexTitle": "Song Title",
      "plexArtist": "Artist Name",
      "score": 0.95
    }
  ],
  "unmatched": [
    {
      "title": "Unavailable Song",
      "artist": "Artist Name",
      "matched": false
    }
  ]
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/import/spotify \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "serverUrl": "http://192.168.1.100:32400",
    "plexToken": "your-plex-token",
    "libraryId": "1"
  }'
```

---

#### POST /api/import/deezer

Import a Deezer playlist.

**Request/Response**: Same format as Spotify import

---

#### POST /api/import/apple

Import an Apple Music playlist.

**Request/Response**: Same format as Spotify import

---

#### POST /api/import/tidal

Import a Tidal playlist.

**Request/Response**: Same format as Spotify import

---

#### POST /api/import/youtube

Import a YouTube Music playlist.

**Request/Response**: Same format as Spotify import

---

#### POST /api/import/amazon

Import an Amazon Music playlist.

**Request/Response**: Same format as Spotify import

---

#### POST /api/import/qobuz

Import a Qobuz playlist.

**Request/Response**: Same format as Spotify import

---

#### POST /api/import/listenbrainz

Import a ListenBrainz playlist.

**Request/Response**: Same format as Spotify import

---

#### POST /api/import/file

Import a playlist from a file (M3U, CSV, etc.).

**Authentication**: Required

**Request Body**:
```json
{
  "content": "file content as string",
  "filename": "playlist.m3u",
  "serverUrl": "http://192.168.1.100:32400",
  "plexToken": "your-plex-token",
  "libraryId": "1"
}
```

**Response**: Same format as other import endpoints

---

### Playlist Endpoints

#### GET /api/playlists

Get user's playlists.

**Authentication**: Required

**Query Parameters**:
- `limit` (optional): Number of playlists to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response**:
```json
{
  "playlists": [
    {
      "id": 1,
      "user_id": 1,
      "plex_playlist_id": "12345",
      "name": "My Playlist",
      "source": "spotify",
      "source_url": "https://open.spotify.com/playlist/...",
      "created_at": 1640000000000,
      "updated_at": 1640000000000
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

---

#### GET /api/playlists/:id

Get playlist details.

**Authentication**: Required

**Response**:
```json
{
  "playlist": {
    "id": 1,
    "user_id": 1,
    "plex_playlist_id": "12345",
    "name": "My Playlist",
    "source": "spotify",
    "source_url": "https://open.spotify.com/playlist/...",
    "created_at": 1640000000000,
    "updated_at": 1640000000000
  }
}
```

---

#### POST /api/playlists

Create a new playlist in Plex.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "My New Playlist",
  "trackKeys": ["12345", "67890"],
  "serverUrl": "http://192.168.1.100:32400",
  "plexToken": "your-plex-token",
  "libraryId": "1"
}
```

**Response**:
```json
{
  "success": true,
  "playlist": {
    "id": 1,
    "plex_playlist_id": "12345",
    "name": "My New Playlist"
  }
}
```

---

#### PUT /api/playlists/:id

Update playlist metadata.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "Updated Playlist Name"
}
```

**Response**:
```json
{
  "success": true,
  "playlist": {
    "id": 1,
    "name": "Updated Playlist Name"
  }
}
```

---

#### DELETE /api/playlists/:id

Delete a playlist.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "message": "Playlist deleted successfully"
}
```

---

#### GET /api/playlists/:id/tracks

Get tracks in a playlist.

**Authentication**: Required

**Response**:
```json
{
  "tracks": [
    {
      "ratingKey": "12345",
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "duration": 180000
    }
  ]
}
```

---

#### POST /api/playlists/:id/tracks

Add tracks to a playlist.

**Authentication**: Required

**Request Body**:
```json
{
  "trackKeys": ["12345", "67890"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Tracks added successfully"
}
```

---

#### DELETE /api/playlists/:id/tracks/:trackId

Remove a track from a playlist.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "message": "Track removed successfully"
}
```

---

### Mix Endpoints

#### POST /api/mixes/weekly

Generate a Weekly Mix (top tracks from most-played artists).

**Authentication**: Required

**Request Body**:
```json
{
  "playlistName": "Your Weekly Mix"
}
```

**Response**:
```json
{
  "success": true,
  "playlist": {
    "id": "12345",
    "name": "Your Weekly Mix",
    "trackCount": 50
  }
}
```

**Error Response** (insufficient play history):
```json
{
  "success": false,
  "message": "Not enough play history to generate Weekly Mix. Listen to more music and try again!"
}
```

---

#### POST /api/mixes/daily

Generate a Daily Mix (recent plays + related tracks + rediscoveries).

**Authentication**: Required

**Request Body**:
```json
{
  "playlistName": "Daily Mix"
}
```

**Response**: Same format as Weekly Mix

---

#### POST /api/mixes/timecapsule

Generate a Time Capsule (old tracks with artist diversity).

**Authentication**: Required

**Request Body**:
```json
{
  "playlistName": "Time Capsule"
}
```

**Response**: Same format as Weekly Mix

---

#### POST /api/mixes/newmusic

Generate a New Music Mix (tracks from recently added albums).

**Authentication**: Required

**Request Body**:
```json
{
  "playlistName": "New Music Mix"
}
```

**Response**: Same format as Weekly Mix

---

#### POST /api/mixes/custom

Generate a custom mix with user-provided settings.

**Authentication**: Required

**Request Body**:
```json
{
  "mixType": "weekly",
  "playlistName": "Custom Weekly Mix",
  "settings": {
    "topArtists": 10,
    "tracksPerArtist": 15
  }
}
```

**Response**: Same format as Weekly Mix

---

#### POST /api/mixes/all

Generate all mix types at once.

**Authentication**: Required

**Request Body**: None

**Response**:
```json
{
  "success": true,
  "playlists": [
    {
      "type": "weekly",
      "playlistId": "12345",
      "name": "Your Weekly Mix",
      "trackCount": 50
    },
    {
      "type": "daily",
      "playlistId": "67890",
      "name": "Daily Mix",
      "trackCount": 35
    }
  ],
  "message": "Successfully created 4 playlist(s)"
}
```

---

### Schedule Endpoints

#### GET /api/schedules

Get user's schedules.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "schedules": [
    {
      "id": 1,
      "user_id": 1,
      "playlist_id": 1,
      "schedule_type": "playlist_refresh",
      "frequency": "daily",
      "start_date": "2024-01-01",
      "last_run": 1640000000000,
      "config": {}
    }
  ]
}
```

---

#### POST /api/schedules

Create a new schedule.

**Authentication**: Required

**Request Body**:
```json
{
  "playlist_id": 1,
  "schedule_type": "playlist_refresh",
  "frequency": "daily",
  "start_date": "2024-01-01",
  "config": {}
}
```

**Valid Values**:
- `schedule_type`: `playlist_refresh` or `mix_generation`
- `frequency`: `daily`, `weekly`, `fortnightly`, `monthly`

**Response**:
```json
{
  "success": true,
  "schedule": {
    "id": 1,
    "user_id": 1,
    "playlist_id": 1,
    "schedule_type": "playlist_refresh",
    "frequency": "daily",
    "start_date": "2024-01-01",
    "last_run": null,
    "config": {}
  }
}
```

---

#### PUT /api/schedules/:id

Update a schedule.

**Authentication**: Required

**Request Body**:
```json
{
  "frequency": "weekly",
  "start_date": "2024-02-01"
}
```

**Response**:
```json
{
  "success": true,
  "schedule": {
    "id": 1,
    "frequency": "weekly",
    "start_date": "2024-02-01"
  }
}
```

---

#### DELETE /api/schedules/:id

Delete a schedule.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "message": "Schedule deleted successfully"
}
```

---

### Missing Tracks Endpoints

#### GET /api/missing

Get user's missing tracks (tracks that couldn't be matched during import).

**Authentication**: Required

**Response**:
```json
{
  "missingTracks": [
    {
      "id": 1,
      "user_id": 1,
      "playlist_id": 1,
      "playlist_name": "My Playlist",
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "position": 5,
      "after_track_key": "12345",
      "added_at": 1640000000000,
      "source": "spotify"
    }
  ],
  "total": 10
}
```

---

#### POST /api/missing/retry

Retry matching for missing tracks.

**Authentication**: Required

**Request Body**:
```json
{
  "trackIds": [1, 2, 3]
}
```

**Response**:
```json
{
  "success": true,
  "matched": 2,
  "stillMissing": 1,
  "results": [
    {
      "id": 1,
      "matched": true,
      "plexRatingKey": "12345"
    },
    {
      "id": 2,
      "matched": true,
      "plexRatingKey": "67890"
    },
    {
      "id": 3,
      "matched": false
    }
  ]
}
```

---

#### DELETE /api/missing/:id

Remove a missing track from the database.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "message": "Missing track removed successfully"
}
```

---

#### DELETE /api/missing/playlist/:playlistId

Clear all missing tracks for a specific playlist.

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "message": "Missing tracks cleared for playlist"
}
```

---

### Discovery Endpoints

#### GET /api/discovery/charts

Get available music charts from various services.

**Authentication**: Required

**Query Parameters**:
- `country` (optional): Country code (e.g., "US", "UK", "AU")

**Response**:
```json
{
  "charts": [
    {
      "id": "spotify-top-50-global",
      "name": "Spotify Top 50 Global",
      "source": "spotify",
      "category": "top"
    },
    {
      "id": "apple-music-top-100",
      "name": "Apple Music Top 100",
      "source": "apple",
      "category": "top"
    }
  ]
}
```

---

#### POST /api/discovery/charts/import

Import a chart as a playlist.

**Authentication**: Required

**Request Body**:
```json
{
  "chartId": "spotify-top-50-global",
  "serverUrl": "http://192.168.1.100:32400",
  "plexToken": "your-plex-token",
  "libraryId": "1"
}
```

**Response**: Same format as import endpoints

---

### Admin Endpoints

All admin endpoints require admin privileges.

#### GET /api/admin/stats

Get system statistics.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "stats": {
    "totalUsers": 50,
    "activeUsers": 35,
    "totalPlaylists": 500,
    "totalMissingTracks": 1000,
    "cacheSize": 250
  }
}
```

---

#### GET /api/admin/users

Get all users.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "users": [
    {
      "id": 1,
      "plex_user_id": "123456",
      "plex_username": "john_doe",
      "created_at": 1640000000000,
      "last_login": 1640000000000
    }
  ],
  "total": 50
}
```

---

#### GET /api/admin/missing

Get aggregated missing tracks across all users.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "missingTracks": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "count": 15,
      "users": ["user1", "user2", "user3"]
    }
  ],
  "total": 100
}
```

---

#### GET /api/admin/jobs

Get background job status.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "jobs": [
    {
      "name": "Daily Scraper",
      "schedule": "0 2 * * *",
      "lastRun": 1640000000000,
      "nextRun": 1640086400000,
      "status": "completed"
    },
    {
      "name": "Schedule Checker",
      "schedule": "0 * * * *",
      "lastRun": 1640000000000,
      "nextRun": 1640003600000,
      "status": "running"
    }
  ]
}
```

---

### Migration Endpoints

#### POST /api/migrate/desktop

Import data from the desktop Electron app.

**Authentication**: Required

**Request Body**:
```json
{
  "version": "1.0.0",
  "exportedAt": 1640000000000,
  "user": {
    "plexToken": "token",
    "plexUser": {},
    "plexServer": {}
  },
  "settings": {
    "country": "US",
    "libraryId": "1",
    "matchingSettings": {},
    "mixSettings": {}
  },
  "playlists": [],
  "schedules": [],
  "missingTracks": []
}
```

**Response**:
```json
{
  "success": true,
  "imported": {
    "playlists": 10,
    "schedules": 5,
    "missingTracks": 50
  },
  "message": "Desktop data imported successfully"
}
```

---

## Postman Collection

A Postman collection with all endpoints and example requests is available at:
`/docs/Playlist-Lab-API.postman_collection.json`

Import this collection into Postman to quickly test all API endpoints.

---

## Additional Resources

- **OpenAPI Specification**: `/docs/openapi.yaml`
- **Deployment Guide**: `/docs/DEPLOYMENT.md`
- **User Guide**: `/docs/USER_GUIDE.md`
- **Developer Guide**: `/docs/DEVELOPER_GUIDE.md`

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-repo/issues
- Documentation: https://docs.playlist-lab.com
- Email: support@playlist-lab.com
