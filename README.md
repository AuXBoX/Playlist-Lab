# Playlist Lab

A desktop app for importing, generating, and managing playlists on your Plex Media Server.

## Features

### Import Playlists
Import playlists from external music services and match tracks to your Plex library:
- **Spotify** - Import from URL (no login required) or connect your account for personal playlists
- **Deezer** - Search public playlists or connect your account for personal playlists
- **Apple Music** - Import from playlist URL
- **Tidal** - Import from URL or connect your account for personal playlists
- **YouTube Music** - Import from URL or connect your account for personal playlists
- **Amazon Music** - Import from public playlist URL
- **Qobuz** - Import from playlist URL
- **ListenBrainz** - Import public playlists and personalized recommendations (Daily/Weekly Jams) by username
- **M3U/M3U8 Files** - Import local playlist files
- **iTunes XML** - Import playlists from iTunes/Music app library exports

### Charts & Discovery
Discover trending music and create playlists from charts:
- **ARIA Charts** (Australia) - Official Australian music charts including Top Singles, Hip-Hop/R&B, Dance, and decade charts
- **Deezer Charts** - Global and country-specific top tracks
- **Last.fm Charts** - Most scrobbled tracks by region
- **Popular Playlists** - Curated playlists from all supported services (Deezer, Apple Music, Tidal, YouTube Music, Amazon Music, Qobuz)
- **Decade Playlists** - 80s, 90s, 2000s, 2010s hits
- **Genre Playlists** - Pop, Rock, Hip-Hop, R&B, Country, Dance

### Generate Personal Mixes
Create personalized playlists based on your Plex listening history:
- **Your Weekly Mix** - Top tracks from your most-played artists
- **Daily Mix** - Recent plays + related songs + rediscoveries
- **Time Capsule** - Rediscover tracks you haven't played recently (with artist diversity)
- **New Music Mix** - Tracks from recently added albums
- **Customizable Settings** - Adjust track counts, time thresholds, and artist limits for each mix type
- **Create Custom Mix** - Build your own playlist with full control:
  - **Source Options**: All Tracks, Played, Unplayed, Recently Played, Top Artists (with history period selection)
  - **Filters**: Genre (from your library), Min rating, Added within, Year range
  - **Expansion**: Add sonically similar tracks, Add tracks from similar artists
  - **Output**: Track count, Max per artist, Sort by (Random/Play Count/Rating/Date Added/Last Played/Title), Shuffle toggle

### Playlist Management
- **Edit Playlists** - Add/remove tracks, manually match unmatched tracks
- **Sort & Reorder** - Sort tracks by title, artist, status, or score; drag-and-drop to reorder
- **Export Missing** - Export unmatched tracks to CSV for reference
- **Schedule Imports** - Auto-refresh playlists weekly, fortnightly, or monthly
- **Backup & Restore** - Export playlists to portable JSON format, restore from backup
- **Sharing** - Share playlists with Plex managed users
- **Rename on Import** - Customize playlist names before importing

### Matching Settings
- **Configurable Match Threshold** - Set minimum score for automatic matching (0-100%)
- **Strict Mode** - Require exact artist matches
- **Album Matching** - Include album name in matching criteria
- **Rating Preferences** - Prefer higher-rated tracks, skip low-rated tracks unless perfect match
- **Penalty Keywords** - Reduce scores for unwanted versions (live, karaoke, cover, etc.)
- **Priority Keywords** - Boost scores for preferred versions (remastered, original, stereo, etc.)
- **Editable Patterns** - Customize matching patterns for featured artists, versions, and various artists
- **Auto-Complete** - Automatically create playlist if all tracks match 100%
- **Playlist Prefixes** - Add source prefixes to playlist names (SPOT:, DEEZ:, APPL:, etc.)

### Auto-Update
- Automatic update notifications when new versions are available
- One-click download from GitHub releases

## Installation

### From Release
Download the latest release from [GitHub Releases](https://github.com/AuXBoX/Playlist-Lab/releases):

**Windows:**
- **Portable** - Single .exe, no installation required
- **Installer** - NSIS setup wizard

**macOS:**
- **DMG** - Disk image installer
- **ZIP** - Portable app bundle

> ⚠️ **macOS Users:** The app is not code-signed, so macOS may show "Playlist Lab is damaged and can't be opened." To fix this:
> 1. Open Terminal
> 2. Run: `xattr -cr /Applications/Playlist\ Lab.app` (adjust path if needed)
> 3. Or right-click the app → Open → Open (first time only)

**Linux:**
- **DEB** - Debian/Ubuntu package
- **AppImage** - Portable, runs on most distros
- **tar.gz** - Manual installation

### From Source
```bash
git clone https://github.com/AuXBoX/Playlist-Lab.git
cd Playlist-Lab
npm install
```

## Usage

### Development
```bash
npm run electron:dev
```

## How It Works

1. Sign in with your Plex account
2. Select your Plex server and music library
3. Import playlists from external sources or generate personal mixes
4. Tracks are matched against your Plex library using fuzzy matching
5. Create playlists directly in Plex with matched tracks

## Tech Stack

- Electron
- React + TypeScript
- Vite
- Plex API

## License

MIT
