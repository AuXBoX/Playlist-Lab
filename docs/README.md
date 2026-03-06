# Playlist Lab

A desktop app for importing, generating, and managing playlists on your Plex Media Server.

**Current Version:** v1.1.1

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
- **Individual Generation** - Generate each mix type separately or all at once
- **Customizable Settings** - Adjust track counts, time thresholds, and artist limits for each mix type
- **Create Custom Mix** - Build your own playlist with full control:
  - **Source Options**: All Tracks, Played, Unplayed, Recently Played, Top Artists (with history period selection)
  - **Filters**: Genre (from your library), Min rating, Added within, Year range
  - **Expansion**: Add sonically similar tracks, Add tracks from similar artists
  - **Output**: Track count, Max per artist, Sort by (Random/Play Count/Rating/Date Added/Last Played/Title), Shuffle toggle

### Playlist Management
- **Edit Playlists** - Add/remove tracks, manually match unmatched tracks
- **Sort & Reorder** - Sort tracks by title, artist, status, or score; drag-and-drop to reorder
- **Album & Format Display** - See which album matched tracks come from, plus codec and bitrate
- **Export Missing** - Export unmatched tracks to CSV for reference
- **Missing Tracks Database** - Tracks that can't be matched during import are stored with their original position. After adding the missing music to Plex, retry matching to insert them at the correct position.
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
- One-click download and install from GitHub releases

## Installation Options

Playlist Lab is available in two versions:

### 🖥️ Desktop App (Recommended for Personal Use)
**Single-user, standalone application with embedded server**

- ✅ Simple one-click installation
- ✅ No server setup required
- ✅ All data stored locally
- ✅ System tray integration
- ✅ Auto-update support

**Download:** [GitHub Releases](https://github.com/AuXBoX/Playlist-Lab/releases)
- **Windows**: NSIS installer (.exe) or portable executable
- **macOS**: DMG disk image or ZIP archive
- **Linux**: AppImage or DEB package

### 🌐 Server Installation (For Multi-User/Remote Access)
**Multi-user web server with mobile apps**

- ✅ Multiple user accounts
- ✅ Remote/network access
- ✅ Centralized playlist management
- ✅ Native iOS and Android apps
- ✅ Scheduled background jobs

**Download:** [GitHub Releases](https://github.com/AuXBoX/Playlist-Lab/releases)
- **Windows**: Inno Setup installer with Windows service - [Guide](docs/WINDOWS_INSTALLER_GUIDE.md)
- **macOS**: DMG/PKG installer with launchd service - [Guide](docs/MACOS_INSTALLER_GUIDE.md)
- **Linux**: DEB/RPM package with systemd service - [Guide](docs/LINUX_INSTALLER_GUIDE.md)

## Project Structure

This is a monorepo containing:
- **Desktop App** (`apps/desktop/`) - Standalone Electron app with embedded server
- **Server** (`apps/server/`) - Express.js REST API with SQLite database
- **Web App** (`apps/web/`) - React web application
- **Mobile App** (`apps/mobile/`) - React Native app for iOS and Android
- **Tray App** (`tray-app/`) - Server management tool (for server installation)

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed structure documentation

### From Source

```bash
git clone https://github.com/AuXBoX/Playlist-Lab.git
cd Playlist-Lab
npm install
```

**Desktop App:**
```bash
cd apps/desktop
npm install
npm run dev
```

**Server + Web:**
```bash
# Terminal 1 - Start server
cd apps/server
npm run dev

# Terminal 2 - Start web UI
cd apps/web
npm run dev
```

See [Developer Guide](docs/DEVELOPER_GUIDE.md) for detailed development setup.

## Usage

### Desktop App
1. Launch Playlist Lab from your applications menu
2. Sign in with your Plex account
3. Select your Plex server and music library
4. Start importing and managing playlists

### Server Installation
1. Access the web UI at `http://localhost:3000` (or your server address)
2. Sign in with your Plex account
3. Each user has their own account and settings
4. Mobile apps available for iOS and Android

## How It Works

1. Sign in with your Plex account
2. Select your Plex server and music library
3. Import playlists from external sources or generate personal mixes
4. Tracks are matched against your Plex library using fuzzy matching
5. Create playlists directly in Plex with matched tracks

## Documentation

- [User Guide](docs/USER_GUIDE.md) - Complete user documentation
- [API Documentation](docs/API.md) - REST API reference
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Development setup and guidelines
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment instructions
- [Project Structure](PROJECT_STRUCTURE.md) - Detailed project organization
- [Monorepo Guide](docs/MONOREPO_GUIDE.md) - Workspace management

## Tech Stack

### Backend
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- Winston (logging)
- node-cron (scheduling)

### Frontend (Web)
- React 18 + TypeScript
- Vite
- React Router
- CSS3

### Frontend (Mobile)
- React Native
- Expo
- React Navigation
- AsyncStorage

### Desktop (Tray App)
- Electron
- TypeScript
- Platform-specific APIs

### Testing
- Jest
- fast-check (property-based testing)
- Supertest (API testing)

## Building

### Build All Installers
```bash
bash scripts/build-all-installers.sh
```

### Platform-Specific Builds
```bash
# Windows
bash scripts/installers/windows/build-windows.sh

# macOS
bash scripts/installers/macos/build-macos.sh

# Linux
bash scripts/installers/linux/build-linux.sh
```

See [scripts/README.md](scripts/README.md) for detailed build instructions.

## License

MIT
