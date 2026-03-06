# Import Debug Instructions

## Debug Logging Enabled

I've added comprehensive debug logging to track the import flow. The server now creates a file called `import-debug.log` in the `apps/server` directory.

## Steps to Debug

1. **Restart the server**:
   ```
   Stop both servers (Ctrl+C)
   Run: scripts/start-dev.bat
   ```

2. **Delete old log** (optional):
   ```
   Delete apps/server/import-debug.log if it exists
   ```

3. **Perform an import**:
   - Go to the Import page
   - Paste an Apple Music playlist URL
   - Click Import
   - Wait for it to complete or show the progress modal

4. **Check the log file**:
   - Open `apps/server/import-debug.log`
   - Look for these sections:
     - `=== APPLE MUSIC SCRAPING RESULTS ===`
     - `=== SCRAPING COMPLETE ===`
     - `=== EMITTING SCRAPING COMPLETE EVENT ===`
     - `=== SSE SENDING EVENT ===`

## What to Look For

### In APPLE MUSIC SCRAPING RESULTS:
```json
{
  "url": "...",
  "imageCount": X,
  "artworkImageCount": X,
  "coverUrl": "..." or null,
  "hasCoverUrl": true/false,
  "trackCount": X
}
```

**Key questions:**
- Is `imageCount` > 0? (Are there images on the page?)
- Is `artworkImageCount` > 0? (Did we find artwork images?)
- Is `coverUrl` present? (Did we extract a URL?)

### In SCRAPING COMPLETE:
```json
{
  "playlistName": "...",
  "trackCount": X,
  "coverUrl": "..." or null,
  "hasCoverUrl": true/false
}
```

**Key question:**
- Is `coverUrl` still present after scraping?

### In EMITTING SCRAPING COMPLETE EVENT:
```json
{
  "type": "progress",
  "phase": "scraping",
  "coverUrl": "..." or null,
  "playlistName": "..."
}
```

**Key question:**
- Is `coverUrl` being emitted in the progress event?

### In SSE SENDING EVENT:
```json
{
  "type": "progress",
  "phase": "scraping" or "matching",
  "coverUrl": "..." or null,
  "currentTrackName": "..."
}
```

**Key questions:**
- Is `coverUrl` present in SSE events?
- Is `currentTrackName` present during matching?

## Troubleshooting

### If coverUrl is null in APPLE MUSIC SCRAPING RESULTS:
- The Apple Music page doesn't have images loaded
- The selectors aren't finding the right images
- Check the `imgTagCount` and `first3ImgTags` in the log

### If coverUrl is present in scraping but null in SSE:
- The data isn't being passed through correctly
- Check the import service code

### If coverUrl is in SSE but not showing in UI:
- Frontend isn't receiving or processing the SSE events correctly
- Check browser console for SSE messages

## Next Steps

After you run an import and check the log file, share the relevant sections from `import-debug.log` so I can see exactly what's happening at each step.
