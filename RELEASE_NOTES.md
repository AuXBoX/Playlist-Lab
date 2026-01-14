# Release Notes

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
