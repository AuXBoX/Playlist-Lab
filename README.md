# Playlist Lab

A desktop app for importing, generating, and managing playlists on your Plex Media Server.

## Features

### Import Playlists
Import playlists from external music services and match tracks to your Plex library:
- **Deezer** - Search public playlists or connect your account for personal playlists
- **Spotify** - Connect your account and import your playlists (requires API credentials)
- **Apple Music** - Import from playlist URL
- **Tidal** - Import from URL or connect your account for personal playlists
- **YouTube Music** - Import from URL or connect your account for personal playlists
- **Amazon Music** - Import from public playlist URL
- **Qobuz** - Import from playlist URL

### Charts & Discovery
Discover trending music and create playlists from charts:
- **ARIA Charts** (Australia) - Official Australian music charts including Top Singles, Hip-Hop/R&B, Dance, and decade charts
- **Deezer Charts** - Global and country-specific top tracks
- **Last.fm Charts** - Most scrobbled tracks by region
- **Decade Playlists** - 80s, 90s, 2000s, 2010s hits
- **Genre Playlists** - Pop, Rock, Hip-Hop, R&B, Country, Dance

### Generate Personal Mixes
Create personalized playlists based on your Plex listening history:
- **Your Weekly Mix** - Top tracks from your most-played artists
- **Daily Mix** - ~150 tracks combining recent plays, related songs, and rediscoveries (tracks not played in 20+ days)
- **Time Capsule** - Rediscover tracks you haven't played in 30+ days
- **New Music Mix** - Tracks from recently added albums

### Playlist Management
- **Edit Playlists** - Add/remove tracks, manually match unmatched tracks
- **Schedule Imports** - Auto-refresh playlists weekly, fortnightly, or monthly
- **Backup & Restore** - Export playlists to portable JSON format, restore from backup
- **Sharing** - Share playlists with Plex managed users
- **Rename on Import** - Customize playlist names before importing

### Matching Settings
- **Configurable Match Threshold** - Set minimum score for automatic matching (0-100%)
- **Strict Mode** - Require exact artist matches
- **Album Matching** - Include album name in matching criteria

## Installation

### From Release
Download the latest release from [GitHub Releases](https://github.com/AuXBoX/Playlist-Lab/releases):

**Windows:**
- **Portable** - Single .exe, no installation required
- **Installer** - NSIS setup wizard

**macOS:**
- **DMG** - Disk image installer
- **ZIP** - Portable app bundle

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

### Build
Run `scripts/build.bat` and select:
1. **Platform** - Windows, macOS, Linux, or All
2. **Build Type** - Portable/App, Installer, or Both

### GitHub Management
Run `scripts/github-manager.bat` for:
- Commit and push changes
- Create releases with multi-platform builds
- Manage tags and releases

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
