# Spotify Import Troubleshooting

## Issue: Preview Not Available

### Error Message
```
Unable to fetch Spotify playlist data. Possible reasons:
• The playlist may be private or region-restricted
• Spotify may have changed their page structure
• The playlist URL may be invalid
```

### Why This Happens
Spotify frequently updates their web pages, which can break web scraping. This is expected and not a bug in the app.

### Solutions

#### 1. Try Direct Import (Recommended)
Even if preview fails, the import function may still work:
1. Paste the Spotify playlist URL
2. Click "Import" (not "Preview")
3. The app will attempt to fetch the playlist during import
4. If successful, you'll see the matching results

#### 2. Use a Different Playlist
- Try a different public Spotify playlist
- Some playlists may be region-restricted or private
- Official Spotify playlists (like "Today's Top Hits") usually work better

#### 3. Set Up OAuth (If You Have Credentials)
If you already have Spotify developer credentials:
1. Expand "Setup OAuth Connection" section
2. Enter your Client ID and Secret
3. Click "Save & Connect"
4. Complete the OAuth flow
5. Try importing again

#### 4. Use Alternative Sources
Consider using other music services that have stable APIs:
- **Deezer**: Has a public API, very reliable
- **ListenBrainz**: Open-source, no authentication needed
- **Apple Music**: May work for some playlists
- **YouTube Music**: May work for some playlists

## Issue: Import Also Fails

### If Both Preview and Import Fail

#### Check the URL
Make sure you're using the correct format:
```
✅ Good: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
❌ Bad: https://open.spotify.com/user/spotify/playlist/...
❌ Bad: spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
```

#### Try These Playlists (Known to Work)
- Today's Top Hits: `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`
- RapCaviar: `https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd`
- Hot Country: `https://open.spotify.com/playlist/37i9dQZF1DX1lVhptIYRda`

#### Check Playlist Privacy
- The playlist must be public
- Private playlists require OAuth
- Collaborative playlists may have restrictions

## Issue: OAuth Setup Fails

### "Spotify has restricted new app creation"
This is a Spotify limitation, not an app issue. Solutions:
1. Use direct import instead (no OAuth needed)
2. If you already have a Spotify app, use those credentials
3. Use alternative music services (Deezer, ListenBrainz, etc.)

### "Invalid credentials"
- Double-check your Client ID and Secret
- Make sure you copied them correctly (no extra spaces)
- Verify the redirect URI is set correctly in Spotify Dashboard:
  ```
  http://localhost:3000/api/spotify/callback
  ```

### "Authorization failed"
- Make sure you approved the authorization request
- Check that your Spotify app has the correct scopes
- Try disconnecting and reconnecting

## Technical Details

### How Scraping Works
The app tries multiple methods to fetch Spotify playlists:
1. **oEmbed API**: Spotify's public embed API
2. **Page Scraping**: Extracts data from Spotify's web pages
3. **Embed Page**: Fetches data from embed pages

### Why Scraping Can Fail
- Spotify changes their page structure frequently
- JavaScript-rendered content is hard to scrape
- Rate limiting may block excessive requests
- Some playlists have access restrictions

### Why OAuth is More Reliable
- Uses official Spotify API
- Not affected by page structure changes
- Works for private playlists
- Has higher rate limits
- But requires Spotify developer credentials

## Best Practices

### For Most Users
1. Start with direct import (no setup)
2. Use popular public playlists
3. If it fails, try a different playlist
4. Consider using Deezer as an alternative

### For Power Users
1. Set up OAuth if you have credentials
2. Use OAuth for private playlists
3. Keep credentials saved for future use
4. OAuth is more reliable long-term

## Getting Help

### If Nothing Works
1. Check the server logs for detailed errors
2. Try restarting the server
3. Clear browser cache and cookies
4. Try a different browser
5. Report the issue with:
   - The playlist URL you tried
   - The exact error message
   - Whether preview or import failed
   - Your browser and OS

### Reporting Issues
When reporting Spotify import issues, include:
- ✅ Playlist URL (if public)
- ✅ Error message from the app
- ✅ Whether you tried OAuth
- ✅ Server logs (if available)
- ❌ Don't share your Spotify credentials

## Future Improvements

The app may add these features in the future:
- Puppeteer-based scraping (more reliable)
- Third-party Spotify API services
- Cached playlist data
- Automatic retry with different methods
- Better error messages with specific solutions
