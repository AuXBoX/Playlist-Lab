# Release Notes

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
