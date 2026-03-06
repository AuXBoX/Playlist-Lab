# Release Notes

## v1.1.1

### Bug Fixes
- **Build Error Fix** - Fixed duplicate function declaration (`handleSpotifySearch`) that prevented the app from building successfully

---

## v1.1.0

### Critical Fixes
- **Infinite Loading Screen Fix** - Added comprehensive error handling and 10-second safety timeout to prevent app from hanging during initialization. All API calls during startup now have proper error handling to ensure the app always loads.
- **Improved Version Detection** - Enhanced version reading with multiple fallback methods and extensive logging to properly detect app version in portable builds.

### Improvements
- **Better Error Recovery** - Failed API calls during startup (libraries, servers, schedules) no longer block the app from loading
- **Startup Reliability** - Added safety timeout that forces the app to show after 10 seconds even if some initialization steps fail

### Bug Fixes
- **Loading Hang Prevention** - App will no longer get stuck at loading screen if server connection fails or API calls timeout
- **Graceful Degradation** - App now continues to function even if some features fail to initialize

---

## v1.0.9

### Improvements
- **Missing Tracks Matching** - Missing Tracks page now uses the same sophisticated matching algorithm as the import process, respecting all your matching settings. This significantly improves the ability to find tracks that were previously missed due to partial matches.
- **Better Page Spacing** - Added proper padding and spacing to Missing Tracks page for improved readability
- **Album Display** - Missing tracks now show album name when available

### Bug Fixes
- **Update Notification Fix** - Fixed update modal appearing every time the app opens even when already on the latest version. The app now properly reads version from package.json and remembers when you dismiss an update.
- **Version Detection** - Improved version detection for portable builds with multiple fallback methods

---

## v1.0.8

### New Features
- **Individual Mix Generation** - Generate personal mixes one at a time instead of all at once. New "Generate Individual Mixes" section with buttons for Weekly Mix, Daily Mix, Time Capsule, and New Music Mix.
- **Album & Format in Match Results** - Playlist matching modal now shows which album each matched track comes from, plus codec and bitrate (e.g., "FLAC 1411k", "MP3 320k")

### Improvements
- **Wider Match Results Modal** - Expanded from 600px to 950px to accommodate new Album and Format columns
- **Mix Settings Persistence Fix** - Settings now properly merge with defaults when loading, preventing issues when saved settings are missing newer properties
- **Custom Mix Top Artists Fix** - Selecting "Top Artists" as source now auto-sets artist count to 10 if it was 0
- **Double Scrollbar Fix** - Fixed double scrollbars appearing on macOS in YouTube Music and Edit Playlists pages
- **Windows Taskbar Icon** - Improved icon loading with nativeImage for better Windows compatibility

### Bug Fixes
- Fixed mix settings not being applied correctly when saved settings had missing properties
- Fixed Custom Mix "Top Artists" source not working when first selected

---

## v1.0.7

### New Features
- **Missing Tracks Database** - When importing playlists, tracks that can't be matched are now stored with their original position. After adding the missing music to Plex, use "Missing Tracks" to retry matching and insert them at the correct position in the playlist.
  - View all missing tracks organized by playlist
  - Retry individual playlists or all at once
  - Tracks are inserted at their original position when found
  - Badge shows count of missing tracks in navigation
- **Auto-Update with Download & Install** - Update notifications now offer one-click download and install (downloads the new portable exe, launches it, and closes the old version)
- **Scrollable Release Notes** - Update modal now shows full release notes with scrolling instead of truncating

### Improvements
- Playlist creation now returns the Plex playlist ID for better tracking
- Missing tracks store the "after track" reference for correct positioning when retrying

---

## v1.0.6

### New Features
- **Customizable Mix Settings** - New collapsible settings panel to customize how each personal mix is generated:
  - **Weekly Mix**: Configure number of top artists (5-25) and tracks per artist (3-10)
  - **Daily Mix**: Adjust recent tracks, related tracks, rediscovery tracks (25-100 each), and rediscovery age (7-60 days)
  - **Time Capsule**: Set track count (15-100), "not played in" threshold (14-365 days), and max tracks per artist (1-10)
  - **New Music Mix**: Choose number of recent albums (5-25) and tracks per album (2-10)
- **Create Custom Mix** - Build your own personalized playlists with full control:
  - **Source Options**: All Tracks, Played, Unplayed, Recently Played, Top Artists
  - **History Period**: All Time, Last 7/14/30/60/90 Days (for Recently Played and Top Artists sources)
  - **Top Artists Mode**: Select number of artists (5-50) and tracks per artist (3-20)
  - **Filters**: Genre (populated from your library), Min rating (1-5 stars), Added within (days/months/year), Year range
  - **Expansion Options**: 
    - Add Sonically Similar Tracks (1-10 per seed track)
    - Add Tracks from Similar Artists (3-20 artists, 1-10 tracks each)
  - **Output Controls**: Track count (25-500), Max per artist, Sort by (Random/Play Count/Rating/Date Added/Last Played/Title), Shuffle toggle
  - Custom playlist naming

### Improvements
- **Time Capsule Artist Diversity** - Completely rewritten algorithm ensures variety across artists using round-robin selection instead of pulling from limited session history
- **Settings Persistence** - Mix settings are automatically saved and restored between sessions

### Bug Fixes
- Fixed Time Capsule only pulling tracks from 1-2 artists (now uses direct library query with artist diversity logic)

---

## v1.0.5

### New Features
- **Edit Playlists Auto-Load** - Playlists now load automatically when opening Edit Playlists (no need to click Refresh)
- **Undo Support in Edit Playlists** - Multi-level undo for add/remove track operations with undo count display
- **Split Search in Edit Playlists** - Separate Artist and Track search fields for more precise track finding
- **ListenBrainz "Created For You"** - Now fetches troi-bot recommendations (Daily Jams, Weekly Jams, etc.) alongside user playlists
- **Rating-Based Matching** - Prefer higher-rated tracks and optionally skip low-rated tracks (1-2 stars) unless perfect match
- **Auto-Complete on Perfect Match** - Automatically create playlist without review if all tracks match 100%
- **Playlist Name Prefixes** - Add source prefixes to playlist names (e.g., "SPOT: My Playlist", "DEEZ: Top 40")

### Improvements
- **Smart Playlist Filtering** - Smart playlists are now hidden from Edit Playlists (they can't be edited anyway)
- **Live Album Detection** - Improved matching to penalize tracks from live albums even when track title doesn't say "Live"
- **Unplugged/Concert Detection** - Added detection for "Unplugged", "In Concert" album patterns

### Bug Fixes
- Removed Plex tab from Browse Sources (redundant with Edit Playlists)

### macOS Installation Note
The app is not code-signed. If macOS shows "Playlist Lab is damaged and can't be opened":
1. Open Terminal
2. Run: `xattr -cr /Applications/Playlist\ Lab.app`
3. Or: Right-click the app → Open → Open (first launch only)

---

## v1.0.4

### New Features
- **Spotify URL Import** - Import any public Spotify playlist by URL without needing API credentials
- **M3U/M3U8 Import** - Import playlists from M3U and M3U8 files with #EXTINF tags or "Artist - Title" filenames
- **iTunes XML Import** - Import playlists from iTunes/Music app library exports (File → Library → Export Library)
- **ListenBrainz Import** - Import public playlists from any ListenBrainz user by username
- **Export Missing Tracks** - Export unmatched tracks to CSV after matching for easy reference
- **Track Sorting** - Sort matched tracks by title, artist, status, or match score (click column headers)
- **Track Reordering** - Drag and drop to reorder tracks before creating playlist
- **Auto-Update Notifications** - Get notified when new versions are available with one-click download

### Improvements
- **Larger Window** - Default size increased to 1400x950, minimum 900x700
- **Better Settings Modal** - More padding and wider layout for Matching Settings
- **Fixed Sidebar Header** - "Playlist Lab" title no longer cut off by title bar

### macOS Installation Note
The app is not code-signed. If macOS shows "Playlist Lab is damaged and can't be opened":
1. Open Terminal
2. Run: `xattr -cr /Applications/Playlist\ Lab.app`
3. Or: Right-click the app → Open → Open (first launch only)

---

## v1.0.3

### Improvements
- **Larger Window Size** - Default window increased to 1200x850 for better usability
- **Fixed Sidebar Layout** - Sidebar now stays fixed while main content scrolls
- **Popular Playlists for All Sources** - YouTube Music, Amazon Music, and Qobuz now show curated popular playlists
- **GitHub Manager** - Added option to delete/squash commits

### Bug Fixes
- Fixed sidebar scrolling issues where Matching Settings was cut off
- Fixed build configuration for Linux DEB packages (added author email)
- Fixed artifact paths in GitHub Actions workflow

### macOS Installation Note
The app is not code-signed. If macOS shows "Playlist Lab is damaged and can't be opened":
1. Open Terminal
2. Run: `xattr -cr /Applications/Playlist\ Lab.app`
3. Or: Right-click the app → Open → Open (first launch only)

---

## v1.0.2

### New Features
- **YouTube Music Import** - Import playlists via URL or connect your Google account for personal playlists
- **Amazon Music Import** - Import public playlists via URL
- **Qobuz Import** - Import playlists via URL
- **Deezer OAuth Login** - Optional account connection for personal playlists (in addition to search)
- **Tidal OAuth Login** - Optional account connection for personal playlists and search
- **Multi-Platform Builds** - Added macOS (DMG, ZIP) and Linux (DEB, AppImage, tar.gz) build support
- **Daily Mix** - New personal mix with ~150 tracks: recent plays + related songs + rediscoveries (tracks not played in 20+ days)

### Improvements
- **Rename on Import** - All import sources now support customizing playlist name before import
- **Global Import Progress** - Import progress overlay persists when navigating between pages
- **Matching Score Fix** - Fixed issue where low-score tracks were incorrectly matched
- **Score Display Fix** - Match scores now correctly cap at 100% (was showing >100% in some cases)
- **Window Startup Fix** - Added fallback handling for window display issues
- **Editable Matching Patterns** - Customize fuzzy matching patterns for featured artists, versions, remasters, and various artists names
- **Penalty/Priority Keywords** - Configure keywords that reduce or boost match scores (e.g. penalize "karaoke", prioritize "remastered")
- **Live Version Penalty** - Prefer studio versions over live recordings when matching
- **Soundtrack/Compilation Matching** - Improved matching for compilation albums and soundtracks

### Technical
- Updated build scripts for cross-platform compilation
- Updated GitHub manager for multi-platform releases

---

## v1.0.1

### Features
- Import from Deezer, Spotify, Apple Music, Tidal
- Charts from ARIA, Deezer, Last.fm
- Personal mixes based on Plex listening history
- Playlist scheduling for auto-refresh
- Backup and restore playlists
- Share playlists with managed users

---

## v1.0.0

Initial release.
