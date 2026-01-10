# Playlist Lab

A desktop app for importing, generating, and managing playlists on your Plex Media Server.

## Features

### Import Playlists
Import playlists from external music services and match tracks to your Plex library:
- **Deezer** - Search and import any public playlist
- **Spotify** - Connect your account and import your playlists (requires API credentials)
- **Apple Music** - Import from playlist URL
- **Tidal** - Import from playlist URL

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
- **Time Capsule** - Rediscover tracks you haven't played in 30+ days
- **New Music Mix** - Tracks from recently added albums

### Playlist Management
- **Edit Playlists** - Add/remove tracks, manually match unmatched tracks
- **Schedule Imports** - Auto-refresh playlists weekly, fortnightly, or monthly
- **Backup & Restore** - Export playlists to JSON, restore from backup
- **Sharing** - Share playlists with Plex managed users

## Installation

### From Release
Download the latest release from [GitHub Releases](https://github.com/AuXBoX/Playlist-Lab/releases):
- **Portable** - Single .exe, no installation required
- **Installer** - NSIS setup wizard

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
1. **Portable** - Single .exe, no installation
2. **Installer** - NSIS setup wizard
3. **Both** - Build both versions
4. **Dev mode** - Run without building

### Build for MacOS

Disable signing if process is not in place:

```
export CSC_IDENTITY_AUTO_DISCOVERY=false
```

Then run `npm run build:mac` to generate the packages in `scripts/release`.

### GitHub Management
Run `scripts/github-manager.bat` for:
- Commit and push changes
- Create releases with version tagging
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
