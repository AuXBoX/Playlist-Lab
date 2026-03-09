## Playlist Lab

A comprehensive music playlist management system with Plex Media Server integration. Import playlists from multiple sources, generate smart mixes, and sync them to your Plex server.

## Features

- **Multi-Source Import**: Import playlists from Spotify, Apple Music, YouTube, and more
- **Smart Playlist Generation**: Create dynamic playlists based on genres, moods, and listening patterns
- **Plex Integration**: Seamless sync with Plex Media Server
- **Multi-User Support**: Manage playlists for multiple Plex users and share between them
- **Scheduling**: Automatically update playlists on a schedule
- **Missing Track Detection**: Identify and track songs not available in your library
- **Cross-Platform**: Available as web app, desktop app, and mobile app

## Applications

This is a monorepo containing multiple applications:

### Server (Multi-User Web Server)
- **Location**: `apps/server/`
- **Type**: Express.js REST API with SQLite database
- **Features**: Multi-user authentication, playlist management, Plex integration, scheduling
- **Deployment**: Can be deployed anywhere (VPS, cloud, local network)
- **Port**: 3001 (configurable)

### Web App (Responsive PWA)
- **Location**: `apps/web/`
- **Type**: React Progressive Web App (PWA)
- **Features**: Full-featured interface, works on desktop and mobile
- **Responsive**: Adapts to any screen size (desktop, tablet, mobile)
- **Installable**: Add to home screen on mobile devices
- **Access**: Connect to any Playlist Lab server
- **Platforms**: Any device with a modern browser

### Desktop App
- **Location**: `apps/desktop/`
- **Type**: Standalone Electron application
- **Features**: Embedded server, single-user, portable
- **Platforms**: Windows, macOS, Linux

## Quick Start

### Server Installation

**Option 1: Windows Installer**
```cmd
# Download and run the installer
PlaylistLabServer-Setup-1.1.3.exe
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

### Desktop App

Download the appropriate installer for your platform:
- Windows: `PlaylistLab-Setup-1.1.3.exe`
- macOS: `PlaylistLab-1.1.3.dmg`
- Linux: `PlaylistLab-1.1.3.deb`

### Web App on Mobile

The web app works perfectly on mobile devices:

**iOS (iPhone/iPad)**
1. Open Safari and navigate to your server URL
2. Tap Share → "Add to Home Screen"
3. App icon appears on home screen

**Android**
1. Open Chrome and navigate to your server URL
2. Tap menu → "Install app"
3. App icon appears in app drawer

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

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
- **Frontend**: React, TypeScript, Vite
- **Mobile**: React Native, Expo
- **Desktop**: Electron
- **Testing**: Jest, fast-check (property-based testing)
- **Build**: TypeScript, Vite, Electron Builder, EAS Build

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

