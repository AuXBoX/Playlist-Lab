# Dynamic Popular Playlists by Country

## Current Status
- **Hardcoded URLs**: ImportPage.tsx has hardcoded playlist URLs that don't change by country
- **Issue**: "Top Songs - Australia" shows "Chroma: Today's Dance Hits" because the URL is wrong
- **Goal**: Dynamically fetch actual country-specific popular playlists from each service

## What Works Now
- ✅ **Deezer**: Has public API with country-specific charts (`/chart/{country}/tracks`)
- ✅ **Spotify**: Could use Web API to get featured playlists by country (requires OAuth)
- ✅ **YouTube Music**: ytmusic-api can browse charts/explore sections

## What Doesn't Work
- ❌ **Apple Music**: No public API for charts
- ❌ **Tidal**: No public API
- ❌ **Amazon Music**: No public API
- ❌ **Qobuz**: No public API

## Implementation Plan

### Phase 1: Backend API Endpoints
Create endpoints to fetch popular playlists by country:

```
GET /api/discovery/popular?source=deezer&country=AU
GET /api/discovery/popular?source=youtube&country=AU
GET /api/discovery/popular?source=spotify&country=AU
```

### Phase 2: Service Implementations

#### Deezer (Easy - Public API)
```typescript
// Already exists in scrapers.ts
export async function getDeezerCharts(country: string): Promise<ExternalPlaylist[]>
```

#### YouTube Music (Medium - ytmusic-api)
```typescript
// New function needed
export async function getYouTubeMusicCharts(country: string): Promise<ExternalPlaylist[]> {
  const ytmusic = new YTMusic();
  await ytmusic.initialize();
  
  // Use ytmusic.getCharts() or browse explore section
  // Note: YouTube Music charts may not be country-specific
}
```

#### Spotify (Medium - Requires OAuth)
```typescript
// New function needed
export async function getSpotifyFeaturedPlaylists(country: string, accessToken: string): Promise<ExternalPlaylist[]> {
  // Use Spotify Web API: GET /browse/featured-playlists?country={country}
}
```

#### Others (Hard - No API)
For Apple Music, Tidal, Amazon Music, Qobuz:
- Option 1: Remove country selector for these sources
- Option 2: Use Puppeteer to scrape (unreliable, slow)
- Option 3: Manually curate a list of popular playlists

### Phase 3: Frontend Updates

```typescript
// ImportPage.tsx
const [popularPlaylists, setPopularPlaylists] = useState<PopularPlaylist[]>([]);
const [isLoadingPopular, setIsLoadingPopular] = useState(false);

useEffect(() => {
  if (activeSource === 'spotify' || activeSource === 'ai' || activeSource === 'file' || activeSource === 'listenbrainz') {
    // These sources don't have popular playlists
    setPopularPlaylists([]);
    return;
  }
  
  fetchPopularPlaylists();
}, [activeSource, selectedCountry]);

const fetchPopularPlaylists = async () => {
  setIsLoadingPopular(true);
  try {
    const response = await fetch(`/api/discovery/popular?source=${activeSource}&country=${selectedCountry}`);
    const data = await response.json();
    setPopularPlaylists(data.playlists || []);
  } catch (err) {
    console.error('Failed to fetch popular playlists:', err);
    setPopularPlaylists([]);
  } finally {
    setIsLoadingPopular(false);
  }
};
```

## Recommendation

**Start with Deezer** since it already has the API support:
1. Create `/api/discovery/popular` endpoint
2. Implement Deezer charts fetching (already exists in scrapers.ts)
3. Update frontend to call this endpoint
4. Test with Deezer first

**Then add YouTube Music** using ytmusic-api:
1. Research ytmusic-api's chart/browse capabilities
2. Implement YouTube Music charts fetching
3. Note: May not be truly country-specific

**Spotify** requires user OAuth, so it's more complex.

**Others** (Apple Music, Tidal, Amazon, Qobuz) should either:
- Show generic curated playlists (not country-specific)
- Hide the popular playlists section entirely
- Show a message: "Popular playlists not available for this source"

## Quick Fix for Now

Remove the fake country-specific labels and just show generic playlists:
- Change "Top Songs - Australia" to "Today's Dance Hits" (the actual playlist)
- Remove country selector for sources without API support
- Only show country selector for Deezer (and eventually YouTube Music/Spotify)
