# Import Button Not Working - Debug Guide

## Symptoms

- Clicking "Import Playlist" button causes page to scroll to top
- Nothing happens - no progress modal, no error message
- Page just scrolls to top and stays there

## Possible Causes

1. **JavaScript Error**: An error is thrown before the progress modal can show
2. **EventSource Error**: The SSE connection fails to establish
3. **React State Issue**: State updates aren't triggering re-renders
4. **Button Disabled**: The button might be disabled due to validation

## Debug Steps

### 1. Check Browser Console

Open browser developer tools (F12) and check the Console tab for errors. Look for:

```
[ImportPage] ===== HANDLE IMPORT CALLED - BUILD v2026-02-11-15:00 =====
```

If you DON'T see this message, the function isn't being called at all.

If you DO see this message, check what comes after it:
- `[ImportPage] Import URL: ...` - Shows the URL being imported
- `[ImportPage] Active source: ...` - Shows which service (apple, spotify, etc.)
- `[ImportPage] Creating EventSource...` - SSE connection starting
- `[ImportPage] SSE connection established` - SSE connection created

### 2. Check for Errors

Look for red error messages in the console like:
- `TypeError: Cannot read property...`
- `ReferenceError: ... is not defined`
- `SyntaxError: ...`

### 3. Check Network Tab

Open the Network tab in developer tools and look for:
- `/api/import/progress/{sessionId}` - Should show as "pending" (EventSource connection)
- `/api/import/apple` (or other service) - Should show the import request

### 4. Check if Button is Disabled

The button is disabled if:
- `isImporting` is true (already importing)
- No URL/username/file/prompt entered
- For AI: No Gemini API key

Check the button in the Elements tab to see if it has `disabled` attribute.

## Quick Fix

If the console shows the function is being called but nothing happens, try this:

1. **Hard Refresh**: Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) to clear cache
2. **Check Server**: Make sure the server is running on port 3000
3. **Check Logs**: Look at the server console for errors

## Common Issues

### Issue: "EventSource is not defined"

This means the browser doesn't support Server-Sent Events. Solution: Use a modern browser (Chrome, Firefox, Edge).

### Issue: "Failed to construct 'EventSource'"

The SSE endpoint URL is invalid. Check that the server is running and accessible.

### Issue: Page scrolls to top but nothing happens

This usually means:
1. An error is thrown early in handleImport
2. The progress modal state isn't being set
3. React isn't re-rendering

## Manual Test

To test if the import system works, open the browser console and run:

```javascript
// Test if handleImport exists
console.log('Testing import...');

// Manually trigger import (replace with your actual URL)
const testUrl = 'https://music.apple.com/us/playlist/...';

// This should show the progress modal
// If it doesn't, there's a React state issue
```

## Server Logs to Check

Look for these in the server console:

```
[Import] Starting import from apple: <url>
[Import] Cache miss, scraping apple:<url>
[Apple Music] Using Puppeteer browser scraping
```

If you see:
```
Error: spawn UNKNOWN
```

Then Puppeteer is failing (known issue on Windows). Use Spotify or Deezer instead.

## Solution

Based on the symptoms, the most likely issue is:

1. **Puppeteer hanging**: Apple Music scraping hangs on Windows
   - Solution: Use Spotify or Deezer instead
   - Or disable Apple Music scraping (see FIX_APPLE_MUSIC_IMPORT.md)

2. **JavaScript error**: Check console for errors
   - Solution: Fix the error shown in console

3. **State not updating**: React isn't re-rendering
   - Solution: Hard refresh the page (Ctrl+Shift+R)

## Next Steps

1. Open browser console (F12)
2. Click "Import Playlist" button
3. Check what messages appear in console
4. Share the console output to diagnose the issue
