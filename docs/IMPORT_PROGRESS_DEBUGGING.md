# Import Progress Display Issue - Debugging Guide

## Issue Description

The import progress modal is stuck showing:
- Phase: scraping
- TrackName: Fetching playlist...

This means the scraping phase is not completing and transitioning to the matching phase.

## Root Cause

Based on previous issues, Puppeteer (browser scraping) fails on Windows with `spawn UNKNOWN` error. This causes the Apple Music scraper to hang indefinitely.

## How to Check Logs

1. **Check server console output** for errors like:
   ```
   [Apple Music Browser] Scraping: <url>
   Error: spawn UNKNOWN
   ```

2. **Look for these log messages**:
   - `[Import] Scraping complete` - If you DON'T see this, scraping failed
   - `[Import] Starting matching phase...` - If you DON'T see this, matching never started
   - `[Matching] Emitting progress event` - If you DON'T see this, matching events aren't being sent

## Solution: Disable Browser Scraping for Apple Music

Since Puppeteer doesn't work on Windows, we need to disable browser scraping for Apple Music and use API-only approach (like we did for other services).

### Fix 1: Disable Apple Music Browser Scraping

Edit `apps/server/src/services/scrapers.ts`:

```typescript
export async function scrapeAppleMusicPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  debugLog('[Apple Music Scraper] ========== FUNCTION CALLED ==========');
  debugLog('[Apple Music Scraper] URL:', url);
  debugLog('[Apple Music Scraper] Has progressEmitter:', !!progressEmitter);
  
  // TEMPORARY: Disable browser scraping on Windows
  throw new Error('Apple Music import is temporarily disabled on Windows. Browser scraping (Puppeteer) does not work on this platform. Please use Spotify, Deezer, or another service.');
  
  // Original code commented out:
  // console.log('[Apple Music] Using Puppeteer browser scraping');
  // ...
}
```

### Fix 2: Add Timeout to Browser Scraping

If you want to keep trying browser scraping but prevent hanging, add a timeout:

Edit `apps/server/src/services/browser-scrapers.ts`:

```typescript
export async function scrapeAppleMusicWithBrowser(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  const SCRAPING_TIMEOUT = 30000; // 30 seconds
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Scraping timeout after 30 seconds')), SCRAPING_TIMEOUT);
  });
  
  const scrapingPromise = (async () => {
    // ... existing scraping code ...
  })();
  
  return Promise.race([scrapingPromise, timeoutPromise]) as Promise<ExternalPlaylist>;
}
```

### Fix 3: Fallback to API-Only (Recommended)

The best solution is to implement API-only scraping for Apple Music (no browser needed):

```typescript
export async function scrapeAppleMusicPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Apple Music playlist...'
  });
  
  try {
    // Extract playlist ID from URL
    const match = url.match(/playlist\/([a-zA-Z0-9._-]+)/);
    if (!match) {
      throw new Error('Invalid Apple Music playlist URL');
    }
    
    const playlistId = match[1];
    
    // Use Apple Music API (requires API key)
    const response = await axios.get(`https://api.music.apple.com/v1/catalog/us/playlists/${playlistId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.APPLE_MUSIC_TOKEN}`,
        'Music-User-Token': process.env.APPLE_MUSIC_USER_TOKEN
      }
    });
    
    // Parse response and return tracks
    // ...
  } catch (error) {
    throw new Error('Unable to fetch Apple Music playlist. Please try a different source.');
  }
}
```

## Testing the Fix

1. Apply one of the fixes above
2. Restart the server
3. Try importing an Apple Music playlist
4. Check logs for:
   - Error message (if Fix 1)
   - Timeout message (if Fix 2)
   - Successful scraping (if Fix 3)

## Alternative: Use Different Source

Until Apple Music is fixed, recommend users import from:
- **Spotify** - Works with OAuth (already implemented)
- **Deezer** - Works with API (no browser needed)
- **Tidal, YouTube Music, Amazon Music** - May have same Puppeteer issue

## Progress Display Fix

I've also fixed a field name inconsistency in the progress events. The field should be `currentTrackName` (not `trackName`) everywhere. This is now consistent across:
- `apps/server/src/services/scrapers.ts`
- `apps/server/src/services/import.ts`
- `apps/server/src/services/matching.ts`

## Next Steps

1. Check the server logs to confirm Puppeteer is failing
2. Apply Fix 1 (disable Apple Music) as a temporary solution
3. Test with Spotify or Deezer instead
4. Consider implementing API-only Apple Music scraping (requires Apple Music API key)
