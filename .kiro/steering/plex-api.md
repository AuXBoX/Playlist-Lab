# Plex Media Server API Reference

## Authentication
- Token-based auth via `X-Plex-Token` header or query param
- Required headers: `X-Plex-Product`, `X-Plex-Client-Identifier`, `X-Plex-Platform`
- Optional headers: `X-Plex-Device`, `X-Plex-Device-Name`, `X-Plex-Platform-Version`

### PIN-Based OAuth Flow
1. `POST https://plex.tv/api/v2/pins?strong=true` → Get `id` and `code`
2. Direct user to: `https://app.plex.tv/auth#?clientID={clientId}&code={code}`
3. Poll: `GET https://plex.tv/api/v2/pins/{id}?code={code}` → Get `authToken`
4. Get user: `GET https://plex.tv/api/v2/user` with token
5. Get servers: `GET https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1`

## Type Values (Music)
- **Type 8** = Artist
- **Type 9** = Album
- **Type 10** = Track

## Key Endpoints

### Library Management
| Endpoint | Description |
|----------|-------------|
| `GET /library/sections` | List all libraries (filter by `type=artist` for music) |
| `GET /library/sections/{id}?includeDetails=1` | Library details with types, filters, sorts |
| `GET /library/sections/{id}/all?type=X` | All items of type X with filtering/sorting |

### Content Retrieval
| Endpoint | Description |
|----------|-------------|
| `GET /library/sections/{id}/recentlyAdded?type=9` | Recently added albums |
| `GET /library/sections/{id}/all?type=9&sort=lastViewedAt:desc` | Recently played albums |
| `GET /library/sections/{id}/all?type=10&sort=lastViewedAt:desc` | Recently played tracks |
| `GET /library/metadata/{ratingKey}` | Single item metadata |
| `GET /library/metadata/{ratingKey}/children` | Album tracks or artist albums |

### Playlists
| Endpoint | Description |
|----------|-------------|
| `GET /playlists?playlistType=audio` | All audio playlists |
| `GET /playlists?playlistType=audio&smart=1` | Smart playlists/stations |
| `GET /playlists/{id}/items` | Playlist tracks |
| `POST /playlists` | Create playlist |
| `PUT /playlists/{id}/items` | Add to playlist |
| `DELETE /playlists/{id}/items/{playlistItemID}` | Remove from playlist |

### Discovery & Hubs
| Endpoint | Description |
|----------|-------------|
| `GET /hubs/sections/{id}` | Library hubs (curated sections) |
| `GET /hubs?includeLibraryPlaylists=1` | Global hubs with mixes |
| `GET /hubs/search?query=X` | Search with hub-organized results |
| `GET /library/onDeck` | Continue watching/listening |

### Playback
| Endpoint | Description |
|----------|-------------|
| `GET /library/parts/{partId}/file` | Stream media file |
| `GET /photo/:/transcode?url=X&width=Y&height=Z` | Transcoded artwork |
| `PUT /:/scrobble?key={ratingKey}&identifier=com.plexapp.plugins.library` | Mark as played |
| `PUT /:/unscrobble?key={ratingKey}&identifier=com.plexapp.plugins.library` | Mark as unplayed |

### Timeline (Playback Progress)
| Endpoint | Description |
|----------|-------------|
| `PUT /:/timeline?ratingKey=X&time=Y&state=Z` | Report playback progress |

## Pagination
Use headers or query params:
- `X-Plex-Container-Start` or `?X-Plex-Container-Start=0`
- `X-Plex-Container-Size` or `?X-Plex-Container-Size=50`

Response includes: `offset`, `size`, `totalSize`

## Media Query Syntax (Filtering)
```
# Operators
field=value          # equals
field!=value         # not equals
field>=value         # greater than or equal
field<=value         # less than or equal
field>>=value        # exists and >= (useful for lastViewedAt>>=0)

# Sorting
sort=field:asc       # ascending
sort=field:desc      # descending
sort=field1:desc,field2:asc  # multiple sorts

# Common filters
type=9               # albums only
lastViewedAt>>=0     # has been played
addedAt>=-30d        # added in last 30 days
year>=2020           # year 2020 or later
```

## Response Customization
- `excludeFields=summary,tagline` - Exclude specific fields
- `includeFields=title,thumb` - Include only specific fields
- `excludeElements=Media` - Exclude child elements
- `includeOptionalElements=musicAnalysis` - Include optional data

## Useful Fields in Responses
| Field | Description |
|-------|-------------|
| `ratingKey` | Unique item ID |
| `key` | Path to fetch item details |
| `thumb` | Artwork path (append to server URL) |
| `lastViewedAt` | Unix timestamp of last play |
| `viewCount` | Play count |
| `addedAt` | Unix timestamp when added |
| `duration` | Duration in milliseconds |
| `leafCount` | Track count (for albums) |
| `childCount` | Album count (for artists) |

## Image Transcoding
```
{serverUrl}/photo/:/transcode?url={thumbPath}&width=200&height=200&X-Plex-Token={token}
```
