# Plex Media Server API - Complete Reference

This document provides a comprehensive reference for the Plex Media Server API, extracted from official documentation. It covers authentication, endpoints, data structures, and best practices for building Plex-integrated applications.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Request Headers](#request-headers)
4. [Response Formats](#response-formats)
5. [Type System](#type-system)
6. [Library Endpoints](#library-endpoints)
7. [Metadata Endpoints](#metadata-endpoints)
8. [Playlist Endpoints](#playlist-endpoints)
9. [Play Queue Endpoints](#play-queue-endpoints)
10. [Collection Endpoints](#collection-endpoints)
11. [Search Endpoints](#search-endpoints)
12. [Hubs & Discovery](#hubs--discovery)
13. [Playback & Timeline](#playback--timeline)
14. [Media Query Language](#media-query-language)
15. [Pagination](#pagination)
16. [Response Customization](#response-customization)
17. [Image Transcoding](#image-transcoding)
18. [Audio Transcoding](#audio-transcoding)
19. [Sonic Analysis & Similar Tracks](#sonic-analysis--similar-tracks)
20. [Loudness Analysis](#loudness-analysis)
21. [Status & Sessions](#status--sessions)
22. [Activities](#activities)
23. [Real-time Events](#real-time-events)
24. [Updater](#updater)
25. [Butler Tasks](#butler-tasks)
26. [Server Preferences](#server-preferences)
27. [Server Capabilities](#server-capabilities)
28. [Media Providers](#media-providers)
29. [Metadata Providers](#metadata-providers)
30. [Common Response Fields](#common-response-fields)
31. [Error Handling](#error-handling)
32. [Best Practices](#best-practices)

---

## Overview

The Plex Media Server API is a RESTful API that supports both XML and JSON responses. Clients can request their preferred format using the standard `Accept` HTTP header. JSON is recommended for new applications.

### Key Concepts

- **Keys**: Items have a `key` attribute that follows URL resolution patterns. Keys can be relative or absolute.
- **Rating Keys**: Unique identifiers for metadata items (`ratingKey`)
- **Media Providers**: Starting points for the media library API - `/media/providers` should be the only hard-coded path
- **Source URIs**: Enable unique content references across servers without fixed URLs

---

## Authentication

### Token-Based Authentication

Most endpoints require token-based authentication via the `X-Plex-Token` header or query parameter.

```
# As header
X-Plex-Token: your-auth-token

# As query parameter
?X-Plex-Token=your-auth-token
```

### JWT Authentication (Newer)

Plex supports JSON Web Token (JWT) authentication with:
- Public-key authentication model
- Short-lived tokens (7 days, refreshable)
- Better security than legacy tokens

### PIN-Based OAuth Flow

1. **Generate PIN**
   ```
   POST https://plex.tv/api/v2/pins?strong=true
   ```
   Response: `{ "id": 12345, "code": "ABCD1234", "expiresAt": "..." }`

2. **Direct user to auth page**
   ```
   https://app.plex.tv/auth#?clientID={clientIdentifier}&code={pinCode}&context[device][product]=AppName
   ```

3. **Poll for completion**
   ```
   GET https://plex.tv/api/v2/pins/{pinId}?code={pinCode}
   ```
   When claimed, response includes `authToken`

4. **Get user info**
   ```
   GET https://plex.tv/api/v2/user
   Headers: X-Plex-Token: {authToken}
   ```

5. **Get servers**
   ```
   GET https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1
   Headers: X-Plex-Token: {authToken}
   ```

---

## Request Headers

### Required Headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-Plex-Product` | Application name | `Audex` |
| `X-Plex-Client-Identifier` | Unique client ID (UUID recommended) | `audex-music-player` |
| `X-Plex-Platform` | Platform name | `Android`, `iOS`, `Web` |

### Optional Headers

| Header | Description |
|--------|-------------|
| `X-Plex-Platform-Version` | Platform version |
| `X-Plex-Device` | Device type |
| `X-Plex-Device-Name` | Device name |
| `X-Plex-Token` | Authentication token |
| `X-Plex-Language` | Preferred language (ISO code) |
| `X-Plex-Pms-Api-Version` | API version (default: 1.0) |

### Pagination Headers

| Header | Description |
|--------|-------------|
| `X-Plex-Container-Start` | Starting index (0-based) |
| `X-Plex-Container-Size` | Number of items to return |

---

## Response Formats

### JSON Response Structure

```json
{
  "MediaContainer": {
    "size": 10,
    "totalSize": 1000,
    "offset": 0,
    "Metadata": [
      { "ratingKey": "123", "title": "...", ... }
    ]
  }
}
```

### Common Container Attributes

| Attribute | Description |
|-----------|-------------|
| `size` | Number of items in current response |
| `totalSize` | Total items available (for pagination) |
| `offset` | Current offset in the list |
| `allowSync` | Whether sync is allowed |
| `identifier` | Provider identifier |
| `mediaTagPrefix` | Prefix for media tags |

---

## Type System

### Media Types (Music)

| Type | Value | Description |
|------|-------|-------------|
| Artist | 8 | Music artist |
| Album | 9 | Music album |
| Track | 10 | Music track |

### Media Types (Video)

| Type | Value | Description |
|------|-------|-------------|
| Movie | 1 | Movie |
| Show | 2 | TV Show |
| Season | 3 | TV Season |
| Episode | 4 | TV Episode |
| Clip | 14 | Video clip |

### Playlist Types

| Type | Description |
|------|-------------|
| `audio` | Music playlists |
| `video` | Video playlists |
| `photo` | Photo playlists |

---

## Library Endpoints

### List All Libraries
```
GET /library/sections
```
Returns all library sections. Filter music libraries by `type="artist"`.

### Library Details
```
GET /library/sections/{sectionId}?includeDetails=1
```
Returns library info including supported types, filters, and sorts.

### Library Counts (Fast)
```
GET /library/sections/{sectionId}/all?type=8&X-Plex-Container-Size=0  # Artist count
GET /library/sections/{sectionId}/all?type=9&X-Plex-Container-Size=0  # Album count
GET /library/sections/{sectionId}/all?type=10&X-Plex-Container-Size=0 # Track count
```
Response `totalSize` contains the count without fetching items.

### All Items by Type
```
GET /library/sections/{sectionId}/all?type={typeId}
```

### Recently Added
```
GET /library/sections/{sectionId}/recentlyAdded?type=9
```
Returns items sorted by `addedAt` descending.

### Recently Played
```
GET /library/sections/{sectionId}/all?type=9&sort=lastViewedAt:desc&lastViewedAt>>=0
```
The `lastViewedAt>>=0` filter ensures only played items are returned.

### On Deck (Continue Listening)
```
GET /library/onDeck
```

### Refresh Library
```
GET /library/sections/{sectionId}/refresh
```

### Get Library Filters
```
GET /library/sections/{sectionId}/filters
```
Returns available filters for the library section (genres, years, ratings, etc.).

### Get Library Categories
```
GET /library/sections/{sectionId}/categories
```
Returns browsable categories for the library section (genres, decades, collections, etc.).

### Get All Library Tags
```
GET /library/tags?type={typeId}
```
Returns all tags of a specific type across all libraries (useful for global genre/tag lists).

---

## Metadata Endpoints

### Get Item Details
```
GET /library/metadata/{ratingKey}
```

### Get Children (Album Tracks, Artist Albums)
```
GET /library/metadata/{ratingKey}/children
```

### Get Grandchildren (Artist Tracks)
```
GET /library/metadata/{ratingKey}/grandchildren
```

### Get Related Items
```
GET /library/metadata/{ratingKey}/related
```

### Get Item Images
```
GET /library/metadata/{ratingKey}/images
```

### Mark as Played (Scrobble)
```
PUT /:/scrobble?key={ratingKey}&identifier=com.plexapp.plugins.library
```

### Mark as Unplayed
```
PUT /:/unscrobble?key={ratingKey}&identifier=com.plexapp.plugins.library
```

### Rate Item
```
PUT /:/rate?key={ratingKey}&identifier=com.plexapp.plugins.library&rating={0-10}
```

---

## Playlist Endpoints

### List Playlists
```
GET /playlists?playlistType=audio
GET /playlists?playlistType=audio&smart=1  # Smart playlists only
```

### Get Playlist Details
```
GET /playlists/{playlistId}
```

### Get Playlist Items
```
GET /playlists/{playlistId}/items
```

### Create Playlist
```
POST /playlists?type=audio&title={name}&smart=0&uri={libraryUri}
```

### Add Items to Playlist
```
PUT /playlists/{playlistId}/items?uri={itemUri}
```

### Remove Item from Playlist
```
DELETE /playlists/{playlistId}/items/{playlistItemID}
```

### Move Item in Playlist
```
PUT /playlists/{playlistId}/items/{playlistItemID}/move?after={afterItemID}
```

### Delete Playlist
```
DELETE /playlists/{playlistId}
```

### Upload Playlist (M3U)
```
POST /playlists/upload?path={absolutePath}&sectionID={sectionId}
```

---

## Play Queue Endpoints

Play queues represent the current playback list. They're ephemeral and session-based.

### Create Play Queue
```
POST /playQueues?type=audio&uri={uri}&shuffle=0&repeat=0
```

Parameters:
- `uri`: Source URI (library item, playlist, etc.)
- `shuffle`: 0 or 1
- `repeat`: 0 (none), 1 (one), 2 (all)
- `includeChapters`: Include chapter info
- `extrasPrefixCount`: Number of trailers to prepend

### Get Play Queue
```
GET /playQueues/{playQueueID}
```

### Add to Play Queue (Party Mode)
```
PUT /playQueues/{playQueueID}?uri={uri}
```

### Shuffle Play Queue
```
PUT /playQueues/{playQueueID}/shuffle
```

### Unshuffle Play Queue
```
PUT /playQueues/{playQueueID}/unshuffle
```

### Clear Play Queue
```
DELETE /playQueues/{playQueueID}/items
```

---

## Collection Endpoints

Collections are user-created groupings of media items (movies, shows, albums, etc.).

### Add Items to Collection
```
PUT /library/collections/{collectionId}/items?uri={itemUri}
```
Add one or more items to a collection by URI.

### Remove Item from Collection
```
DELETE /library/collections/{collectionId}/items/{itemId}
```
Remove a specific item from a collection.

### Reorder Item in Collection
```
PUT /library/collections/{collectionId}/items/{itemId}/move?after={afterItemId}
```
Move an item to a new position in the collection.

Note: Collection endpoints at `/library/collections/{collectionId}/X` are rerouted to `/library/metadata/{collectionId}/X` and respond to standard metadata endpoints as well.

---

## Search Endpoints

### Hub Search (Recommended)
```
GET /hubs/search?query={searchTerm}
```
Returns results organized by type (hubs). Includes spell checking and partial matches.

Response includes `reason` codes:
- `title`: Match from title
- `originalTitle`: Match from original title
- `{hubIdentifier}`: Match from related hub

### Voice Search
```
GET /hubs/search/voice?query={searchTerm}
```
Optimized for imprecise input using Levenshtein distance.

### Library Search
```
GET /library/sections/{sectionId}/search?type={typeId}&query={searchTerm}
```

### Autocomplete
```
GET /library/sections/{sectionId}/all?type={typeId}&{field}.query={prefix}
```
Example: `title.query=bea` returns items starting with "bea"

---

## Hubs & Discovery

Hubs are curated content sections (like "Recently Added", "Recommended", etc.).

### Global Hubs
```
GET /hubs?includeLibraryPlaylists=1&includeStations=1
```

### Library Hubs
```
GET /hubs/sections/{sectionId}?count=10
```

### Artist Hubs (Popular Tracks)
```
GET /hubs/sections/{sectionId}?metadataItemId={artistRatingKey}
```
Returns hubs for a specific artist, including "Popular Tracks" from external sources (Last.fm, MusicBrainz). Currently only for music sections.

Response includes Hub array with entries like:
- `title: "Popular"` - Popular tracks from external metadata
- `title: "Albums"` - Artist's albums
- `title: "Related Artists"` - Similar artists

### Transient Hubs Only
```
GET /hubs?onlyTransient=1
```
Returns hubs that change after playback (On Deck, Recently Played).

### Hub Parameters

| Parameter | Description |
|-----------|-------------|
| `count` | Max items per hub |
| `onlyTransient` | Only return dynamic hubs |
| `includeLibraryPlaylists` | Include playlist hubs |
| `includeStations` | Include station hubs |
| `includeExternalMedia` | Include external content |
| `metadataItemId` | Restrict hubs to specific metadata item (artist) |

---

## Playback & Timeline

### Timeline Updates
Report playback progress to the server:
```
PUT /:/timeline?ratingKey={ratingKey}&key={key}&state={state}&time={positionMs}&duration={durationMs}
```

States:
- `playing` - Currently playing
- `paused` - Paused
- `stopped` - Stopped
- `buffering` - Buffering

### Stream URL Construction
```
{serverUrl}{partKey}?X-Plex-Token={token}
```

Where `partKey` comes from `Media[0].Part[0].key` in metadata response.

### Transcode Decision
```
GET /video/:/transcode/universal/decision?...
```
For video transcoding decisions (not typically needed for audio).

---

## Media Query Language

Plex supports a powerful query language for filtering and sorting.

### Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `=` | Equals | `year=2020` |
| `!=` | Not equals | `year!=2020` |
| `>=` | Greater or equal | `year>=2020` |
| `<=` | Less or equal | `year<=2020` |
| `>>=` | Exists and >= | `lastViewedAt>>=0` |
| `<<=` | Exists and <= | `rating<<=5` |

### Sorting

```
sort=field:direction
sort=field1:desc,field2:asc  # Multiple sorts
```

Directions: `asc`, `desc`

Common sort fields:
- `titleSort` - Alphabetical by title
- `addedAt` - Date added
- `lastViewedAt` - Last played
- `year` - Release year
- `rating` - User rating
- `ratingCount` - Number of ratings
- `duration` - Length

### Boolean Logic

```
# AND (implicit with &)
year=2020&rating>=8

# OR (with comma)
year=2020,2021,2022

# Complex expressions with push/pop/or
push=1&index=1&or=1&rating=2&pop=1&duration>=180000
# Parses as: (index=1 OR rating=2) AND duration>=180000
```

### Relative Dates

```
addedAt>=-30d      # Added in last 30 days
addedAt>=-1w       # Added in last week
lastViewedAt>=-7d  # Played in last 7 days
```

### Grouping

```
group=field  # Group results by field
```
Example: `type=10&sort=ratingCount:desc&group=title` - Popular tracks grouped by title

### Limiting

```
limit=100  # Return at most 100 items
```

---

## Pagination

### Request Parameters

```
X-Plex-Container-Start=0   # Starting index
X-Plex-Container-Size=50   # Items per page
```

Or as query parameters:
```
?X-Plex-Container-Start=0&X-Plex-Container-Size=50
```

### Response Fields

```json
{
  "MediaContainer": {
    "offset": 0,
    "size": 50,
    "totalSize": 1000
  }
}
```

### Focus-Based Pagination

Center results on a specific item:
```
?X-Plex-Container-Focus={ratingKey}&X-Plex-Container-Size=20
```

### Best Practices

1. Always check `totalSize` to know if more pages exist
2. Use `size=0` requests to get counts without data
3. Request only what you need - large pages are slower
4. Combine with `limit` for bounded queries

---

## Response Customization

Reduce response size by including/excluding specific data.

### Field Customization

```
# Exclude specific fields
?excludeFields=summary,tagline

# Include only specific fields
?includeFields=title,thumb,ratingKey

# Include optional fields (not normally returned)
?includeOptionalFields=musicAnalysis
```

### Element Customization

```
# Exclude child elements
?excludeElements=Media,Genre,Role

# Include only specific elements
?includeElements=Media

# Include optional elements
?includeOptionalElements=musicAnalysis
```

### Performance Impact

Trimming responses significantly improves performance for large collections. The server can skip database queries for excluded fields.

---

## Image Transcoding

### Transcode URL Format

```
{serverUrl}/photo/:/transcode?url={thumbPath}&width={w}&height={h}&X-Plex-Token={token}
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `url` | Source image path (from `thumb` field) |
| `width` | Target width in pixels |
| `height` | Target height in pixels |
| `minSize` | If 1, scale to fit smaller dimension |
| `upscale` | If 1, allow upscaling |
| `format` | Output format (jpg, png) |

### Example

```javascript
const thumbUrl = `${serverUrl}/photo/:/transcode?url=${encodeURIComponent(item.thumb)}&width=200&height=200&X-Plex-Token=${token}`;
```

### Composite Images (Playlists)

Playlists use `composite` instead of `thumb`:
```
{serverUrl}{playlist.composite}?X-Plex-Token={token}
```

---

## Audio Transcoding

### Transcoded Audio Stream
```
GET /music/:/transcode/universal/start.mp3?path=/library/metadata/{ratingKey}&musicBitrate={bitrate}&X-Plex-Token={token}
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `path` | Path to the metadata item (`/library/metadata/{ratingKey}`) |
| `musicBitrate` | Target bitrate in kbps (320, 256, 128, 64). Omit or 0 for original |
| `mediaIndex` | Index of the media to transcode (-1 for server choice) |
| `partIndex` | Index of the part (usually 0) |
| `protocol` | Protocol to use (http) |
| `directPlay` | 0 to force transcode, 1 for direct play |
| `directStream` | 1 to allow direct streaming |
| `audioBoost` | Audio boost percentage (default 100) |

### Direct Play (Original Quality)
```
GET /library/metadata/{ratingKey}/file?X-Plex-Token={token}
```

### Playback Decision
Get server recommendation for playback method:
```
GET /music/:/transcode/universal/decision?path=/library/metadata/{ratingKey}&X-Plex-Token={token}
```

Response includes `directPlayDecisionCode` and `transcodeDecisionCode` indicating whether direct play or transcoding is recommended.

---

## Sonic Analysis & Similar Tracks

### Get Nearest Tracks (Sonically Similar)
```
GET /library/metadata/{ratingKey}/nearest
```
Returns tracks that are sonically similar based on audio analysis.

### Get Similar Items
```
GET /library/metadata/{ratingKey}/similar?count=20
```
Returns similar items based on metadata matching.

### Get Related Items
```
GET /library/metadata/{ratingKey}/related
```
Returns related content organized in hubs.

### Section-Level Nearest (by Analysis Values)
```
GET /library/sections/{sectionId}/nearest?type=10&values={analysisValues}&limit=50&maxDistance=0.25
```

| Parameter | Description |
|-----------|-------------|
| `type` | Metadata type (10 for tracks) |
| `values` | Music analysis values from a track's `musicAnalysis` field |
| `limit` | Max results (default 50) |
| `maxDistance` | Maximum sonic distance (default 0.25) |

### Include Music Analysis
Add `includeOptionalElements=musicAnalysis` to metadata requests:
```json
{
  "musicAnalysis": {
    "tempo": 120,
    "key": "C",
    "mood": ["energetic"],
    "genre": ["rock"],
    "energy": 0.8,
    "danceability": 0.6
  }
}
```

---

## Loudness Analysis

Plex performs loudness analysis on audio tracks for volume normalization. This data is used by Plexamp for loudness leveling.

### Track Loudness Fields

When tracks have been analyzed, the following fields are available on track metadata:

| Field | Description |
|-------|-------------|
| `loudnessAnalysisVersion` | Version of the loudness analysis (e.g., "2") |
| `integratedLoudness` | Integrated loudness in LUFS (e.g., -14.5) |
| `truePeak` | True peak level in dBTP (e.g., -1.0) |
| `loudnessRange` | Loudness range in LU (e.g., 8.5) |

### Get Stream Loudness Levels (Waveform Data)

Get per-100ms loudness levels for a stream (useful for waveform visualization):

```
GET /library/streams/{streamId}/loudness
```

Returns plain text with one loudness value (in dB) per line, one entry per 100ms.

Example response:
```
-21.5
-20.6
-19.8
-22.1
...
```

### Get Stream Loudness Levels (JSON)

```
GET /library/streams/{streamId}/levels
```

Returns the same data in JSON format.

### Butler Task

The `LoudnessAnalysis` butler task performs loudness analysis on library items:

```
POST /butler/LoudnessAnalysis  # Start loudness analysis
DELETE /butler/LoudnessAnalysis  # Stop loudness analysis
```

---

## Status & Sessions

### Get All Play History
```
GET /status/sessions/history/all?librarySectionID={sectionId}
```
Returns playback history for the library section.

### List Active Sessions
```
GET /status/sessions
```
Returns currently active playback sessions across all clients.

### Get Single History Item
```
GET /status/sessions/history/{historyKey}
```
Returns details for a specific history item.

### Delete Single History Item
```
DELETE /status/sessions/history/{historyKey}
```
Removes a specific item from playback history.

### Terminate a Session
```
POST /status/sessions/terminate?sessionId={sessionId}&reason={reason}
```
Terminates an active playback session.

---

## Activities

Activities represent background tasks and operations running on the server.

### Get All Activities
```
GET /activities
```
Returns all currently running and queued activities (scans, analysis, etc.).

### Cancel a Running Activity
```
DELETE /activities/{activityUUID}
```
Cancels a specific running activity by its UUID.

---

## Real-time Events---

## Real-time Events

### WebSocket Notifications
```
GET /:/websocket/notifications
```

### EventSource (SSE)
```
GET /:/eventsource/notifications
```

### Filter Parameter
- `filters=-log` - All events except logs (default)
- `filters=foo,bar` - Only foo and bar events
- `filters=` - All events
- `filters=-foo,bar` - All except foo and bar

---

## Updater

The updater API allows checking for and applying Plex Media Server updates.

### Query Update Status
```
GET /updater/status
```
Returns current update status, available versions, and download URLs.

### Check for Updates
```
PUT /updater/check?download={0|1}
```
Checks for available updates. Set `download=1` to automatically download any updates found.

### Apply Updates
```
PUT /updater/apply?tonight={0|1}&skip={version}
```
Applies downloaded updates. Use `tonight=1` to schedule update for tonight, or `skip={version}` to skip a specific version.

---

## Butler Tasks (Background Jobs)

```
GET /butler           # List all tasks
POST /butler          # Start all tasks
DELETE /butler        # Stop all tasks
POST /butler/{task}   # Start specific task
DELETE /butler/{task} # Stop specific task
```

### Music-Related Tasks
- `MusicAnalysis` - Analyze music for sonic features
- `LoudnessAnalysis` - Analyze audio loudness levels

---

## Server Preferences

### Get All Preferences
```
GET /:/prefs
```
Returns all server preferences and their current values.

### Set Preferences
```
PUT /:/prefs?{prefName}={value}&{prefName2}={value2}
```
Sets one or more server preferences. Example: `FriendlyName=My Server&sendCrashReports=1`

### Get Single Preference
```
GET /:/prefs/get?id={prefName}
```
Returns a single preference and its value.

### Set Library Section Preferences
```
PUT /library/sections/{sectionId}/prefs?{prefName}={value}
```
Sets preferences for a specific library section.

### Set Metadata Item Preferences
```
PUT /library/metadata/{ratingKey}/prefs?{prefName}={value}
```
Sets preferences for a specific metadata item.

---

## Server Capabilities

The server info response includes capability flags:

| Capability | Description |
|------------|-------------|
| `transcoderAudio` | Audio transcoding supported |
| `musicAnalysis` | Music analysis version (2 = sonic analysis available) |
| `sync` | Sync/download supported |

---

## Media Providers

Media providers are general-purpose entities which supply media to Plex clients. They can be hosted by a media server or in the cloud, linked to a specific Plex account.

### Get Providers
```
GET /media/providers
```

### Provider Features

| Feature | Description |
|---------|-------------|
| `metadata` | Supports metadata endpoints |
| `content` | Exposes content catalog |
| `match` | Can match external content |
| `manage` | Supports editing/managing |
| `timeline` | Accepts timeline updates |
| `playqueue` | Supports play queues |
| `playlist` | Supports playlists |
| `search` | Supports search |
| `promoted` | Provides promoted hubs |
| `continuewatching` | Provides continue watching hub |
| `collection` | Supports collections |
| `imagetranscoder` | Supports image transcoding |
| `queryParser` | Supports media query language |
| `grid` | Supports grid display over time (live TV) |

### Content Directories

Providers expose content through directories with:
- `hubKey` - Discovery hubs endpoint
- `key` - Browse/list endpoint
- `type` - Content type
- `icon` - Optional icon for content directory
- `aspectRatio` - Aspect ratio hint for display (e.g., "1:1", "16:9")

### Nested Content Directories

Content providers can nest directories for deeper hierarchies (e.g., Genres & Moods):

```json
{
  "Directory": [
    {
      "key": "foo",
      "hubKey": "foo2",
      "type": "content",
      "aspectRatio": "1:1",
      "title": "Genres and Moods"
    }
  ]
}
```

## Metadata Providers

Metadata providers supply metadata to items inside Movie and TV Show libraries. They implement the `metadata` and `match` features.

### Common Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Plex-Language` | No | IETF language tag (e.g., 'en-US', 'de-DE') |
| `X-Plex-Country` | No | ISO 3166 two-letter country code |
| `X-Plex-Container-Size` | Yes* | Maximum container size for paged requests |
| `X-Plex-Container-Start` | Yes* | Starting index for paged requests |

*Required for paged requests

### Metadata Feature

Retrieve metadata for a specific piece of content by its ratingKey:

```
GET /library/metadata/{ratingKey}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeChildren` | integer (1/0) | Yes (TV Shows/Seasons) | Returns Children object |
| `episodeOrder` | string | No | Season type ID for ordering |

**Image Endpoint:**

```
GET /library/metadata/{ratingKey}/images
```

Returns MediaContainer with Image array of all available assets.

**Children/Grandchildren:**

```
GET /library/metadata/{ratingKey}/children
GET /library/metadata/{ratingKey}/grandchildren
```

For TV Shows and Seasons, returns child items (Seasons/Episodes). Supports pagination.

### Match Feature

Match media items based on contextual hints:

```
POST /library/metadata/matches
```

**Request Body Attributes:**

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | integer | Yes | Metadata type number |
| `title` | string | Yes* | Title (*Movies/TV Shows) |
| `parentTitle` | string | Yes* | TV Show title (*Seasons) |
| `grandparentTitle` | string | Yes* | TV Show title (*Episodes) |
| `year` | integer | No | Release year |
| `guid` | string | No | External ID (e.g., "tvdb://12345") |
| `index` | integer | No | Season/episode number |
| `parentIndex` | integer | No | Season number (for episodes) |
| `date` | string | No | Air date (if index unavailable) |
| `manual` | integer (1/0) | No | Return multiple matches if 1 |
| `includeAdult` | integer (1/0) | No | Include explicit content |

### Custom Metadata Provider Identifier

Custom providers must use the `tv.plex.agents.custom.` prefix:

```
tv.plex.agents.custom.{yourname}.{service}
```

Example: `tv.plex.agents.custom.johnz.tmdb`

Allowed characters: ASCII letters, numbers, periods `[a-zA-Z0-9.]`

### GUID Construction

Format: `{scheme}://{metadataType}/{ratingKey}`

Examples:
- `plex://movie/5d7768244de0ee001fcc7fed`
- `tv.plex.agents.custom.johnz.tmdb://movie/tmdb-movie-19934`

### Metadata Response Schema

**MediaContainer:**

| Field | Type | Description |
|-------|------|-------------|
| `offset` | integer | Starting position |
| `totalSize` | integer | Total items |
| `identifier` | string | Provider identifier |
| `size` | integer | Items in response |
| `Metadata` | array | Metadata objects |

**Metadata Object - Core Attributes:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ratingKey` | string | Yes | Unique identifier |
| `key` | string | Yes | API endpoint path |
| `guid` | string | Yes | Global unique identifier |
| `type` | string | Yes | Content type |
| `title` | string | Yes | Title |
| `originallyAvailableAt` | string | Yes | Release date (YYYY-MM-DD) |
| `thumb` | string | No | Poster URL |
| `art` | string | No | Background artwork URL |
| `contentRating` | string | No | Age rating (e.g., "PG", "R") |
| `year` | integer | No | Release year |
| `summary` | string | No | Plot synopsis |
| `duration` | integer | No | Runtime in milliseconds |
| `tagline` | string | No | Tagline |
| `studio` | string | No | Production studio |
| `theme` | string | No | Theme music URL (MP3) |

**Season/Episode Attributes:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parentRatingKey` | string | Yes | Parent identifier |
| `parentKey` | string | Yes | Parent endpoint |
| `parentGuid` | string | Yes | Parent GUID |
| `parentType` | string | Yes | Parent type |
| `parentTitle` | string | Yes | Parent title |
| `index` | integer | Yes | Season/episode number |

**Episode-Specific Attributes:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `grandparentRatingKey` | string | Yes | Show identifier |
| `grandparentKey` | string | Yes | Show endpoint |
| `grandparentGuid` | string | Yes | Show GUID |
| `grandparentTitle` | string | Yes | Show title |
| `parentIndex` | integer | Yes | Season number |

**Image Array:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | "background", "backgroundSquare", "clearLogo", "coverPoster", "snapshot" |
| `url` | string | Yes | Full URL to image |
| `alt` | string | No | Alt text |

**Genre Array:**

| Field | Type | Description |
|-------|------|-------------|
| `tag` | string | Genre name |
| `originalTag` | string | Original language genre |

**Guid Array (External IDs):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | External ID (e.g., "imdb://tt0088763") |

Supported providers: `imdb`, `tmdb`, `tvdb`

**People Arrays (Role, Director, Producer, Writer):**

| Field | Type | Description |
|-------|------|-------------|
| `tag` | string | Person's name |
| `thumb` | string | Photo URL |
| `role` | string | Character/role |
| `order` | integer | Display order |

**Rating Array:**

| Field | Type | Description |
|-------|------|-------------|
| `image` | string | Rating badge identifier |
| `type` | string | "audience" or "critic" |
| `value` | float | Rating (0-10) |

Rating image identifiers:
- `imdb://image.rating` - IMDb
- `themoviedb://image.rating` - TheMovieDB
- `rottentomatoes://image.rating.ripe` - RT Critics
- `rottentomatoes://image.rating.upright` - RT Audience

**Children Object:**

| Field | Type | Description |
|-------|------|-------------|
| `size` | integer | Number of children |
| `Metadata` | array | Child metadata objects |

---

## Common Response Fields

### Track Fields

| Field | Type | Description |
|-------|------|-------------|
| `ratingKey` | string | Unique ID |
| `key` | string | Detail endpoint path |
| `title` | string | Track title |
| `grandparentTitle` | string | Artist name |
| `parentTitle` | string | Album name |
| `grandparentRatingKey` | string | Artist ID |
| `parentRatingKey` | string | Album ID |
| `index` | number | Track number |
| `parentIndex` | number | Disc number |
| `duration` | number | Duration in ms |
| `thumb` | string | Artwork path |
| `year` | number | Release year |
| `viewCount` | number | Play count |
| `lastViewedAt` | number | Unix timestamp |
| `addedAt` | number | Unix timestamp |
| `Media` | array | Media info (codec, bitrate, etc.) |

### Album Fields

| Field | Type | Description |
|-------|------|-------------|
| `ratingKey` | string | Unique ID |
| `key` | string | Detail endpoint path |
| `title` | string | Album title |
| `parentTitle` | string | Artist name |
| `parentRatingKey` | string | Artist ID |
| `year` | number | Release year |
| `thumb` | string | Artwork path |
| `leafCount` | number | Track count |
| `duration` | number | Total duration in ms |
| `addedAt` | number | Unix timestamp |
| `Genre` | array | Genre tags |

### Artist Fields

| Field | Type | Description |
|-------|------|-------------|
| `ratingKey` | string | Unique ID |
| `key` | string | Detail endpoint path |
| `title` | string | Artist name |
| `thumb` | string | Artwork path |
| `childCount` | number | Album count |
| `summary` | string | Biography |
| `addedAt` | number | Unix timestamp |

### Playlist Fields

| Field | Type | Description |
|-------|------|-------------|
| `ratingKey` | string | Unique ID |
| `key` | string | Items endpoint path |
| `title` | string | Playlist name |
| `summary` | string | Description |
| `composite` | string | Composite artwork path |
| `leafCount` | number | Track count |
| `duration` | number | Total duration in ms |
| `smart` | boolean | Is smart playlist |
| `content` | string | Smart playlist query (if smart) |
| `addedAt` | number | Unix timestamp |
| `updatedAt` | number | Unix timestamp |

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (success, no body) |
| 400 | Bad Request |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Server Error |

### Error Response Format

```json
{
  "errors": [
    {
      "code": 1001,
      "message": "Error description",
      "status": 400
    }
  ]
}
```

### Token Validation

Check token validity:
```
GET https://plex.tv/api/v2/user
Headers: X-Plex-Token: {token}
```
- 200: Valid token
- 401: Invalid/expired token

---

## Best Practices

### Performance

1. **Use pagination** - Never request all items at once
2. **Limit response fields** - Use `excludeFields` or `includeFields`
3. **Cache aggressively** - Library data changes infrequently
4. **Use appropriate image sizes** - Request transcoded images at display size
5. **Batch requests** - Combine related data fetches

### Reliability

1. **Handle connection failures** - Servers may be unreachable
2. **Support multiple connections** - Servers have local/remote/relay URIs
3. **Implement retry logic** - Transient failures are common
4. **Validate tokens** - Check before making requests

### User Experience

1. **Show loading states** - API calls can be slow
2. **Implement pull-to-refresh** - Let users force updates
3. **Cache artwork** - Images are expensive to fetch
4. **Handle empty states** - Libraries may be empty or scanning

### Security

1. **Never expose tokens** - Keep in secure storage
2. **Use HTTPS** - All Plex connections should be encrypted
3. **Validate server certificates** - Plex uses custom certs
4. **Refresh tokens** - JWT tokens expire after 7 days

---

## Quick Reference

### Music Library - Common Operations

```javascript
// Get music libraries
GET /library/sections
// Filter: type === 'artist'

// Get library counts
GET /library/sections/{id}/all?type=8&X-Plex-Container-Size=0  // Artists
GET /library/sections/{id}/all?type=9&X-Plex-Container-Size=0  // Albums
GET /library/sections/{id}/all?type=10&X-Plex-Container-Size=0 // Tracks

// Get albums (paginated)
GET /library/sections/{id}/all?type=9&X-Plex-Container-Start=0&X-Plex-Container-Size=50

// Get recently added albums
GET /library/sections/{id}/recentlyAdded?type=9&X-Plex-Container-Size=10

// Get recently played albums
GET /library/sections/{id}/all?type=9&sort=lastViewedAt:desc&lastViewedAt>>=0&X-Plex-Container-Size=10

// Get album tracks
GET /library/metadata/{albumRatingKey}/children

// Get playlists
GET /playlists?playlistType=audio

// Search
GET /hubs/search?query=beatles

// Mark track as played
PUT /:/scrobble?key={trackRatingKey}&identifier=com.plexapp.plugins.library

// Report playback progress
PUT /:/timeline?ratingKey={trackRatingKey}&key=/library/metadata/{trackRatingKey}&state=playing&time=30000&duration=180000
```

---

*This document was compiled from the official Plex Media Server API documentation. For the most up-to-date information, consult the official Plex developer resources.*
