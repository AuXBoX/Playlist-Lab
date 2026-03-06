# Fix for Apple Music Import Hanging

## Problem

The import progress gets stuck at "Fetching playlist..." because Puppeteer (browser scraping) doesn't work on Windows.

## Quick Fix

Edit `apps/server/src/services/scrapers.ts` and find the `scrapeAppleMusicPlaylist` function (around line 315).

Replace the entire function with:

```typescript
export async function scrapeAppleMusicPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  // Browser scraping doesn't work on Windows - show clear error
  throw new Error('Apple Music import is not available on Windows. Please use Spotify, Deezer, Tidal, or another service instead.');
}
```

This will immediately show an error message instead of hanging indefinitely.

## Better Solution: Use Spotify or Deezer

These services work perfectly on Windows:

1. **Spotify** - Already configured with OAuth
2. **Deezer** - Works with API (no browser needed)

## Why This Happens

- Apple Music requires browser scraping (Puppeteer) to extract playlist data
- Puppeteer has issues on Windows with the `spawn UNKNOWN` error
- The scraping hangs indefinitely, never reaching the matching phase
- Progress stays stuck at "Phase: scraping | TrackName: Fetching playlist..."

## Logs to Check

Look for these in your server console:

```
[Apple Music Browser] Scraping: <url>
Error: spawn UNKNOWN
```

Or the scraping just hangs with no further output after:
```
[Apple Music] Using Puppeteer browser scraping
[Apple Music] Emitting scraping progress: ...
```

## After Applying Fix

1. Restart the server
2. Try importing from Apple Music - you'll see a clear error message
3. Use Spotify or Deezer instead - they work perfectly!

## Progress Display is Now Fixed

I've also fixed the progress display to show proper track names during matching:
- Scraping phase: "Fetching playlist..." → "Found X tracks"
- Matching phase: "Artist - Track Name" for each track being matched
- Complete phase: "Complete: X matched"

The field name `currentTrackName` is now consistent across all services.
