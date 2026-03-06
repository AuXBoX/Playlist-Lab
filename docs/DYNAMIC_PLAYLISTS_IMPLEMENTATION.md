# Dynamic Popular Playlists Implementation

## Summary

✅ **COMPLETE** - Implemented dynamic loading of popular playlists based on country selection for each import source. Playlists are now fetched by searching for "top songs {country}" instead of using hardcoded URLs.

## Implementation Status

- ✅ Backend routes created and tested
- ✅ YouTube Music search function implemented
- ✅ Frontend state management added
- ✅ Caching with 24-hour TTL implemented
- ✅ All TypeScript compilation errors fixed
- ✅ ytmusic-api package installed
- ✅ Build successful

## Changes Made

### Backend

#### 1. `apps/server/src/services/scrapers.ts`
- **Already existed**: `searchYouTubeMusicPlaylists()` function
  - Uses ytmusic-api to search for playlists
  - Returns up to 20 results with name, URL, and description
  - Handles errors gracefully

#### 2. `apps/server/src/routes/charts.ts`
- **Updated**: Chart endpoint to use search functionality
  - Endpoint: `GET /api/charts/:source/:country`
  - Supports: Deezer, YouTube Music
  - Searches for "top songs {countryName}"
  - Returns array of playlists

#### 3. `apps/server/src/routes/import.ts`
- **Updated**: Search endpoint to support YouTube Music
  - Added YouTube Music case to search switch statement
  - Calls `searchYouTubeMusicPlaylists()` for YouTube Music searches

### Frontend

#### 1. `apps/web/src/pages/ImportPage.tsx`
- **Added state**:
  - `dynamicPlaylists`: Stores fetched playlists
  - `isLoadingDynamicPlaylists`: Loading indicator

- **Added useEffect**: Fetches playlists when source or country changes
  - Checks localStorage cache first (24-hour TTL)
  - Fetches from `/api/charts/:source/:country` if cache is stale
  - Caches results with timestamp

- **Updated rendering**:
  - Uses `dynamicPlaylists` for supported sources (Deezer, YouTube Music, etc.)
  - Shows loading state while fetching
  - Removed hardcoded `getPopularPlaylistsByCountry()` function

## How It Works

1. **User selects a source** (e.g., YouTube Music)
2. **Frontend checks cache** for `playlists_{source}_{country}`
3. **If cache is fresh** (< 24 hours old), use cached playlists
4. **If cache is stale or missing**:
   - Fetch from `/api/charts/youtube/AU` (for Australia example)
   - Backend searches YouTube Music for "top songs Australia"
   - Returns up to 20 relevant playlists
   - Frontend caches results with timestamp
5. **Display playlists** in the grid

## Benefits

- **Dynamic content**: Playlists are always relevant to the selected country
- **No hardcoding**: No need to maintain lists of playlist URLs
- **Caching**: Reduces API calls (once per day per source/country)
- **Scalable**: Easy to add support for more sources
- **User-friendly**: Shows actual popular playlists from each platform

## Supported Sources

- ✅ **Deezer**: Uses Deezer public API search
- ✅ **YouTube Music**: Uses ytmusic-api search
- ⏳ **Apple Music**: Not yet implemented (returns empty array)
- ⏳ **Tidal**: Not yet implemented (returns empty array)
- ⏳ **Amazon Music**: Not yet implemented (returns empty array)
- ⏳ **Qobuz**: Not yet implemented (returns empty array)
- N/A **Spotify**: Uses user's own playlists (OAuth)

## Testing

To test:
1. Select YouTube Music as source
2. Select Australia as country
3. Wait for playlists to load
4. Verify playlists are relevant to Australia
5. Change country to US
6. Verify playlists update to US-relevant content
7. Refresh page - should load from cache instantly

## Cache Management

Cache is stored in localStorage with key format:
```
playlists_{source}_{country}
```

Example:
```json
{
  "playlists": [...],
  "timestamp": 1738123456789
}
```

Cache expires after 24 hours (86400000 ms).

## Future Enhancements

1. Add search support for Apple Music, Tidal, Amazon Music, Qobuz
2. Add manual cache refresh button
3. Add cache size management (clear old entries)
4. Add error retry logic
5. Add playlist preview thumbnails
