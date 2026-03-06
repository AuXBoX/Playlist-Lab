# YouTube Music Import Progress Display Fix

## Issue
When importing a YouTube Music playlist, the progress dialog was showing:
- Wrong cover art (showing "CHROMA" image - appears to be a YouTube channel avatar)
- Wrong playlist name (showing "Home" instead of actual playlist name)

## Root Cause
The YouTube Music scraper in `apps/server/src/services/browser-scrapers.ts` was using overly generic CSS selectors that were picking up the wrong elements:

1. **Playlist Name Selector**: `h1, .title, [class*="playlist-name"]`
   - Too generic - was matching "Home" from page navigation
   - Needed to target the specific detail header element

2. **Cover Art Selector**: `ytmusic-detail-header-renderer img, img[class*="playlist"], img[class*="thumbnail"]`
   - Was picking up channel avatars or other thumbnails
   - Needed to exclude channel avatars (yt3.ggpht.com domain)

## Solution

### Improved Playlist Name Extraction
```typescript
// Try to get playlist name from the detail header (more specific)
const detailHeader = document.querySelector('ytmusic-detail-header-renderer');
if (detailHeader) {
  const headerTitle = detailHeader.querySelector('h2.title, yt-formatted-string.title');
  if (headerTitle) {
    playlistName = headerTitle.textContent?.trim() || playlistName;
  }
}

// Fallback to h1 if detail header not found, but exclude "Home"
if (playlistName === document.title.replace(' - YouTube Music', '').trim()) {
  const h1 = document.querySelector('h1');
  if (h1 && h1.textContent?.trim() && h1.textContent.trim() !== 'Home') {
    playlistName = h1.textContent.trim();
  }
}
```

### Improved Cover Art Extraction
```typescript
// Try to get cover art from detail header specifically
if (detailHeader) {
  const headerImg = detailHeader.querySelector('img');
  if (headerImg) {
    const src = headerImg.getAttribute('src');
    // Exclude channel avatars (yt3.ggpht.com)
    if (src && !src.includes('data:image') && !src.includes('yt3.ggpht.com')) {
      coverUrl = src.split('=')[0];
    }
  }
}

// Fallback: find largest image that's not a channel avatar
if (!coverUrl) {
  const allImages = Array.from(document.querySelectorAll('img'));
  for (const img of allImages) {
    const src = img.getAttribute('src');
    // Skip channel avatars and data URIs
    if (src && !src.includes('data:image') && !src.includes('yt3.ggpht.com')) {
      const width = img.naturalWidth || img.width;
      if (width >= 200) {
        coverUrl = src.split('=')[0];
        break;
      }
    }
  }
}
```

## Key Improvements

1. **More Specific Selectors**: Target `ytmusic-detail-header-renderer` specifically instead of generic elements
2. **Channel Avatar Filtering**: Exclude images from `yt3.ggpht.com` domain (YouTube channel avatars)
3. **"Home" Text Filtering**: Explicitly exclude "Home" text from playlist name
4. **Size-Based Image Selection**: Prefer larger images (>= 200px) for cover art
5. **Better Logging**: Added detailed logging to track what's being extracted

## Testing
To test the fix:
1. Import a YouTube Music playlist
2. Verify the progress dialog shows:
   - Correct playlist name (not "Home")
   - Correct playlist cover art (not channel avatar)
3. Check server logs for extraction details

## Files Modified
- `apps/server/src/services/browser-scrapers.ts` (lines 370-430)
