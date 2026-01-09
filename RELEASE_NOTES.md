# Release Notes

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
