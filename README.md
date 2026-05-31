## Playlist Lab

Feel free to donate 
[Tip Jar](https://www.paypal.com/donate/?business=6H5L2S8SAQWBW&no_recurring=0&currency_code=AUD)

A comprehensive music playlist management system with Plex Media Server integration. Import playlists from multiple sources, generate smart mixes, and sync them to your Plex server.

## What's New in v1.2.4

### Import Queue System
- ✅ Background processing - imports run without blocking the UI
- ✅ Real-time progress tracking with detailed status
- ✅ Queue management: view pending, processing, and completed imports
- ✅ Retry failed imports and cancel pending ones
- ✅ Import history with timestamps

### New Export System
- ✅ Complete rewrite for better performance and reliability
- ✅ Enhanced error handling and recovery
- ✅ Real-time export progress updates

### Schedule Management
- ✅ "Run Now" button for individual schedules
- ✅ "Run All" to execute all schedules at once
- ✅ Manual testing without waiting for scheduled time

### Chart Updates
- ✅ ARIA Charts - Latest option added
- ✅ Billboard - Latest option added
- ✅ Always get the most current chart playlists

### Critical Fixes
- ✅ Fixed reverse proxy causing Spotify OAuth failures
- ✅ Fixed UI blocking during playlist imports
- ✅ Fixed playlist artwork import failures
- ✅ Fixed missing dependencies on Ubuntu
- ✅ Fixed shared playlists "Invalid playlist ID" error

### Spotify Improvements
- ✅ Search Spotify's entire catalog (not just your playlists)
- ✅ Popup-based OAuth (no more session loss)
- ✅ Premium subscription requirement clearly indicated

See [Release Notes](docs/RELEASE_NOTES_v1.2.4.md) for complete details.

## Features

### Core Features
- **Multi-Source Import**: Import playlists from Spotify, Apple Music, and more
- **Smart Playlist Generation**: Create dynamic playlists based on genres, moods, and listening patterns
- **Plex Integration**: Seamless sync with Plex Media Server
- **Multi-User Support**: Manage playlists for multiple Plex users and share between them
- **Playlist Sharing**: Share playlists between Plex Home users
- **Scheduling**: Automatically update playlists on a schedule
- **Missing Track Detection**: Identify and track songs not available in your library

### Import Features
- **Import Queue System**: Background processing with real-time progress tracking
- **Queue Management**: View pending, processing, and completed imports
- **Retry Failed Imports**: Easily retry imports that failed with one click
- **Cancel Pending Imports**: Cancel imports before they start processing
- **Import History**: Track all imports with success/failure status and timestamps
- **Non-Blocking UI**: Continue browsing and working while imports process in background
- **Spotify Search**: Search Spotify's entire catalog, not just your playlists
- **OAuth Authentication**: Secure popup-based OAuth for Spotify (no session loss)
- **Batch Import**: Import multiple playlists at once
- **Progress Tracking**: Real-time import progress with detailed status

### Export Features
- **Modern Export System**: Complete rewrite for better performance and reliability
- **Progress Tracking**: Real-time export progress updates
- **Enhanced Error Handling**: Improved recovery from export failures
- **Batch Export**: Export multiple playlists efficiently

### Schedule Management
- **Run Now**: Execute any individual schedule immediately
- **Run All**: Execute all schedules at once with one click
- **Manual Testing**: Test schedules without waiting for scheduled time
- **Flexible Control**: More options for schedule management

### Chart Playlists
- **ARIA Charts**: Australian charts with "Latest" option
- **Billboard Charts**: US charts with "Latest" option
- **Up-to-Date**: Always get the most current chart playlists
- **Multiple Sources**: Support for various chart providers

### User Experience
- **Responsive PWA**: Works on desktop, tablet, and mobile browsers
- **Installable**: Add to home screen on mobile devices for app-like experience
- **System Tray App**: Easy server management on Windows/macOS/Linux (installer versions)
- **Cross-Platform**: Available as web app and desktop app

## Applications

This is a monorepo containing multiple applications:

### Server (Multi-User Web Server) - **Actively Maintained**
- **Location**: `apps/server/`
- **Type**: Express.js REST API with SQLite database
- **Features**: Multi-user authentication, playlist management, Plex integration, scheduling
- **Deployment**: Can be deployed anywhere (VPS, cloud, local network)
- **Port**: 3001 (configurable)

### Web App (Responsive PWA) - **Actively Maintained**
- **Location**: `apps/web/`
- **Type**: React Progressive Web App (PWA)
- **Features**: Full-featured interface, works on desktop and mobile browsers
- **Responsive**: Adapts to any screen size (desktop, tablet, mobile)
- **Installable**: Add to home screen on mobile devices for app-like experience
- **Access**: Connect to any Playlist Lab server
- **Platforms**: Any device with a modern browser

## Quick Start

### Server Installation

**Option 1: Windows Installer**
```cmd
# Download and run the installer
PlaylistLabServer-Setup-1.2.4.exe
```

**Option 2: Docker (Recommended for Development)**
```bash
# Quick start
docker-compose up -d

# View logs
docker-compose logs -f

# Access at http://localhost:3001
```

**Option 3: Manual Installation**
```bash
# Install dependencies
npm install

# Build shared package
cd packages/shared && npm run build && cd ../..

# Build server
cd apps/server && npm run build && cd ../..

# Build web app
cd apps/web && npm run build && cd ../..

# Start server
cd apps/server && npm start
```

### Web App on Mobile

The web app is fully responsive and works on mobile devices through your browser:

**iOS (iPhone/iPad)**
1. Open Safari and navigate to your server URL
2. Tap Share → "Add to Home Screen"
3. App icon appears on home screen with full-screen app experience

**Android**
1. Open Chrome and navigate to your server URL
2. Tap menu → "Install app" or "Add to Home Screen"
3. App icon appears in app drawer with full-screen app experience

The PWA provides an app-like experience with offline support and push notifications.

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- Plex Media Server with authentication token

### Third-Party Service Requirements

**Spotify Import** (Optional)
- Spotify Premium subscription required for the app owner
- Free Spotify accounts cannot browse or search playlists via API
- See [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api) for details

### Reverse Proxy Support

Playlist Lab works seamlessly behind reverse proxies (Nginx, Apache, Caddy, etc.). 

**Configuration:**
Set `PUBLIC_URL` in your `.env` file to your public domain:
```env
PUBLIC_URL=https://playlist-lab.yourdomain.com
```

**Example Nginx Configuration:**
```nginx
location / {
  proxy_pass http://localhost:3001;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

This ensures OAuth callbacks and other features work correctly with your reverse proxy setup.

### Setup
```bash
# Clone repository
git clone https://github.com/yourusername/playlist-lab.git
cd playlist-lab

# Install dependencies
npm install

# Build shared package
cd packages/shared && npm run build && cd ../..

# Start development servers
npm run dev:server  # Server on port 3001
npm run dev:web     # Web app on port 5173
```

## Technology Stack

- **Backend**: Node.js, Express.js, SQLite, TypeScript
- **Frontend**: React, TypeScript, Vite, PWA
- **Testing**: Jest, fast-check (property-based testing)
- **Build**: TypeScript, Vite

## Configuration

### Server Environment Variables

Create a `.env` file in `apps/server/` with the following variables:

```env
# Server Configuration
PORT=3001
PUBLIC_URL=http://127.0.0.1:3001

# Session Secret (generate a random string)
SESSION_SECRET=your-random-secret-here

# Spotify OAuth (Optional - for Spotify import)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/api/spotify/callback
```

**Important Notes:**
- Use `127.0.0.1` instead of `localhost` for OAuth redirect URIs (better compatibility)
- Spotify requires Premium subscription for the app owner to use playlist features
- See `.env.example` files for complete configuration options

### Server Installers
The Windows/macOS/Linux server installers include a system tray application for easy server management. The server runs as a background service and is accessed via web browser at `http://localhost:3001`.

**Installation Methods:**
- **Windows**: Run the `.exe` installer - includes system tray app, creates Start Menu shortcuts, optionally starts on boot
- **macOS**: Install the `.dmg` or `.pkg` - includes system tray app, creates an application bundle in Applications
- **Linux**: Install the `.deb` (Debian/Ubuntu) or `.rpm` (Fedora/RHEL) - includes systemd service and tray app
- **Docker**: Use `docker-compose up -d` (recommended for development and cloud deployments)
- **Manual**: Build and run the server directly (see Quick Start)
- **VPS/Cloud**: Deploy using the deployment scripts in `deployment/`

**System Tray Features:**
- Start/stop/restart server
- Open web interface in browser
- Change server port
- View server status
- Exit tray application

**Access**: After installation, open your browser to `http://localhost:3001` or use the tray app to open the interface.

## License

See LICENSE file for details.

## Acknowledgments

- Plex Media Server for the excellent media platform
- All the open-source libraries that make this possible

## 📧 Support

- Issues: [GitHub Issues](https://github.com/AuXBoX/playlist-lab/issues)
- Community: [r/PlaylistLab](https://www.reddit.com/r/PlaylistLab/)